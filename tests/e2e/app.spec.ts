import { test, expect } from '@playwright/test';
import { fixtureDetection } from '../fixtures/face';
import path from 'node:path';
const portrait = path.resolve('tests/fixtures/einstein.jpg');

test('navigation, responsive layouts and accessible camera permission boundary', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre visage.');
  await page.getByRole('link', { name: 'Start Live Scan' }).click();
  await expect(page.getByRole('button', { name: 'Activer la caméra' })).toBeVisible();
  expect(await page.locator('video').evaluate((v) => (v as HTMLVideoElement).srcObject)).toBeNull();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/live', '/photo', '/scan', '/report', '/about']) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse photo' }).click();
  await expect(page).toHaveURL(/\/photo$/);
});

test('real local MediaPipe photo → measures → export → erase; no remote requests', async ({
  page,
}) => {
  const remote: string[] = [];
  const writes: string[] = [];
  page.on('request', (r) => {
    if (!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) remote.push(r.url());
    if (r.method() !== 'GET') writes.push(r.url());
  });
  await page.goto('/photo');
  await page.getByLabel('Photo de face', { exact: true }).setInputFiles(portrait);
  await expect(page.getByText('Capture frontale exploitable. 15 mesures disponibles.')).toBeVisible(
    { timeout: 60000 },
  );
  expect(page.workers().some((w) => w.url().endsWith('/vision-worker.js'))).toBe(true);
  expect(await page.locator('.photo-coordinate svg line').count()).toBeGreaterThan(1000);
  const overlay = await page.locator('.photo-coordinate').evaluate((el) => {
    const image = el.querySelector('img')!.getBoundingClientRect();
    const svg = el.querySelector('svg')!.getBoundingClientRect();
    return {
      width: Math.abs(image.width - svg.width),
      height: Math.abs(image.height - svg.height),
    };
  });
  expect(overlay.width).toBeLessThan(1);
  expect(overlay.height).toBeLessThan(1);
  await page.getByRole('button', { name: 'Découvrir mon rapport' }).click();
  await expect(page.getByText('Score global indisponible')).toBeVisible();
  await expect(page.locator('.measurement-card')).toHaveCount(15);
  await page.getByRole('button', { name: 'Yeux', exact: true }).click();
  await expect(page.locator('.measurement-card')).toHaveCount(4);
  await page.getByRole('checkbox', { name: 'Afficher les sous-scores expérimentaux' }).uncheck();
  await expect(page.getByText('Score global indisponible')).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter les mesures' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('psl-lens-rapport.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.measurements).toHaveLength(15);
  expect(exported.score).toBeUndefined();
  expect(exported.representative).toBeUndefined();
  expect(exported.measurements.every((m: { value: number }) => Number.isFinite(m.value))).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Effacer la session' }).click();
  await expect(page.getByText('Votre rapport commence ici.')).toBeVisible();
  expect(page.workers()).toHaveLength(0);
  expect(remote).toEqual([]);
  expect(writes).toEqual([]);
});

test('invalid file and blank image are explicitly rejected by the real detector', async ({
  page,
}) => {
  await page.goto('/photo');
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles({ name: 'fake.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('Format non pris en charge');
  const blank = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 400;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, 400, 400);
    return c.toDataURL().split(',')[1];
  });
  await page.getByLabel('Photo de face', { exact: true }).setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: Buffer.from(blank, 'base64'),
  });
  await expect(page.getByRole('alert')).toContainText('Aucun visage', { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Découvrir mon rapport' })).toBeDisabled();
});

test('real detector refuses two faces instead of selecting one', async ({ page }) => {
  await page.goto('/photo');
  const pair = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/tests/fixtures/einstein.jpg';
    await image.decode();
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0, 600, 800);
    ctx.drawImage(image, 600, 0, 600, 800);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  await page.getByLabel('Photo de face', { exact: true }).setInputFiles({
    name: 'two-faces.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(pair, 'base64'),
  });
  await expect(page.getByRole('alert')).toContainText('seul visage', { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Découvrir mon rapport' })).toBeDisabled();
});

test('live simulated device, real inference, pause, mirror and track cleanup', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('CAMÉRA ACTIVE', { exact: false })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('MS / INFÉRENCE', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(page.getByText('Analyse en pause · caméra active')).toBeVisible();
  await page.getByRole('button', { name: 'Basculer le miroir' }).click();
  await expect(page.getByRole('button', { name: 'Basculer le miroir' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Reprendre l’analyse' }).click();
  await page.evaluate(() => {
    (window as Window & { testTrack?: MediaStreamTrack }).testTrack = (
      document.querySelector('video')!.srcObject as MediaStream
    ).getVideoTracks()[0];
  });
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse photo' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { testTrack?: MediaStreamTrack }).testTrack?.readyState,
      ),
    )
    .toBe('ended');
});

test('guided scan uses actual quality/state/measurement engines with a test-only worker fixture', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  const fixture = fixtureDetection();
  await page.route('**/vision-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `let count=0; const base=${JSON.stringify(fixture)}; self.onmessage=e=>{ const d=e.data; if(d.type==='init'){self.postMessage({id:d.id,ok:true});return;} count++; const yaw=count<=40?0:count<=70?22:-22; const result={...base, timestamp:d.timestamp, pose:{yaw,pitch:0,roll:0,source:'matrix'},pixels:{brightness:130,sharpness:80}};d.bitmap.close();self.postMessage({id:d.id,ok:true,result}); };`,
    }),
  );
  await page.goto('/scan');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await page.getByRole('button', { name: 'Recommencer le scan' }).click();
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page).toHaveURL(/\/report$/, { timeout: 30000 });
  await expect(page.locator('.report-summary')).toContainText('32');
  await expect(page.locator('.report-summary')).toContainText('16');
  await expect(page.getByText('Score global indisponible')).toBeVisible();
  await expect(page.locator('.measurement-card')).toHaveCount(15);
});

test('real face frames through a canvas camera stream produce a Live report', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.audio !== false) throw new Error('Unexpected audio request');
      const image = new Image();
      image.src = '/tests/fixtures/einstein.jpg';
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 640;
      const context = canvas.getContext('2d')!;
      const draw = () => context.drawImage(image, 0, 0, 480, 640);
      draw();
      const stream = canvas.captureStream(12);
      setInterval(draw, 80);
      return stream;
    };
  });
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Créer mon rapport' })).toBeEnabled();
  expect(await page.locator('.media-coordinate svg line').count()).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Créer mon rapport' }).click();
  await expect(page.locator('.measurement-card')).toHaveCount(15);
  await expect(page.locator('.page-heading')).toContainText('Rapport Live');
});

test('pausing ignores a guided observation that was already in flight', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  const fixture = fixtureDetection();
  await page.route('**/vision-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const base=${JSON.stringify(fixture)}; self.onmessage=e=>{ const d=e.data; if(d.type==='init'){self.postMessage({id:d.id,ok:true});return;} self.inflight=true;setTimeout(()=>{d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,timestamp:d.timestamp,pixels:{brightness:130,sharpness:80}}});},600); };`,
    }),
  );
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeEnabled();
  await expect
    .poll(async () =>
      page
        .workers()[0]
        ?.evaluate(() => Boolean((self as unknown as { inflight: boolean }).inflight)),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  // Deliberate delay: wait beyond the known test-only worker response time.
  await page.waitForTimeout(900);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
});
