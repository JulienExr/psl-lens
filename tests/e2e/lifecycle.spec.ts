import { test, expect, type Page } from '@playwright/test';
import { fixtureDetection } from '../fixtures/face';
import path from 'node:path';

async function delayedWorker(page: Page, initDelay = 0) {
  const fixture = fixtureDetection();
  await page.route('**/vision-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const base=${JSON.stringify(fixture)};self.onmessage=e=>{const d=e.data;if(d.type==='init'){setTimeout(()=>self.postMessage({id:d.id,ok:true}),${initDelay});return;}self.pending=true;setTimeout(()=>{d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,timestamp:d.timestamp,pixels:{brightness:130,sharpness:80}}});self.pending=false;},600);};`,
    }),
  );
}
async function trackCameras(page: Page) {
  await page.addInitScript(() => {
    const media = navigator.mediaDevices,
      native = media.getUserMedia.bind(media);
    const target = window as Window & { testStreams?: MediaStream[] };
    target.testStreams = [];
    media.enumerateDevices = async () =>
      [
        { deviceId: 'fake_device_0', groupId: 'test', kind: 'videoinput', label: 'Test camera A' },
        { deviceId: 'fake_device_1', groupId: 'test', kind: 'videoinput', label: 'Test camera B' },
      ] as MediaDeviceInfo[];
    media.getUserMedia = async (constraints) => {
      if (constraints?.audio !== false) throw new Error('Unexpected audio request');
      const video = typeof constraints.video === 'object' ? constraints.video : {};
      const requested =
        typeof video.deviceId === 'object' && 'exact' in video.deviceId
          ? String(video.deviceId.exact)
          : 'fake_device_0';
      // Both logical test devices use Chromium's real fake stream. Its opaque
      // device IDs differ by browser context, so never pass our labels as IDs.
      const { deviceId: ignoredDeviceId, ...nativeVideo } = video;
      void ignoredDeviceId;
      const stream = await native({ ...constraints, video: nativeVideo });
      const track = stream.getVideoTracks()[0],
        settings = track.getSettings.bind(track);
      track.getSettings = () => ({ ...settings(), deviceId: requested });
      target.testStreams!.push(stream);
      return stream;
    };
  });
}
async function inFlight(page: Page) {
  await expect
    .poll(async () =>
      page.workers()[0]?.evaluate(() => Boolean((self as unknown as { pending: boolean }).pending)),
    )
    .toBe(true);
}
async function trackStates(page: Page) {
  return page.evaluate(() =>
    (window as Window & { testStreams?: MediaStream[] }).testStreams!.map(
      (s) => s.getVideoTracks()[0].readyState,
    ),
  );
}

test('stop during inference then immediate start creates a new owner without errors', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await inFlight(page);
  await page.getByRole('button', { name: 'Arrêter', exact: true }).click();
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(() => trackStates(page)).toEqual(['ended', 'live']);
});
test('changing devices during inference ends the old track and preserves the successor', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await inFlight(page);
  await page.getByRole('combobox', { name: 'Caméra', exact: true }).selectOption('fake_device_1');
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await expect.poll(() => trackStates(page)).toEqual(['ended', 'live']);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('Live to Photo cancels the old operation before the imported image is analyzed', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await inFlight(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse photo' }).click();
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(
    page.getByText('Capture frontale exploitable. 15 mesures disponibles.'),
  ).toBeVisible();
  await expect.poll(() => trackStates(page)).toEqual(['ended']);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('clear while initializing ignores late readiness and permits a clean retry', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page, 700);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Chargement du moteur local…')).toBeVisible();
  await page.getByRole('button', { name: 'Effacer la session' }).click();
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await expect.poll(() => trackStates(page)).toEqual(['ended', 'live']);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('runtime worker failure can be retried and never leaks a camera track', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  let loads = 0;
  const fixture = fixtureDetection();
  await page.route('**/vision-worker.js', (route) => {
    loads++;
    return route.fulfill({
      contentType: 'application/javascript',
      body:
        loads === 1
          ? `self.onmessage=e=>{if(e.data.type==='init')self.postMessage({id:e.data.id,ok:true});else throw new Error('TEST WORKER CRASH');};`
          : `const base=${JSON.stringify(fixture)};self.onmessage=e=>{const d=e.data;if(d.type==='init')self.postMessage({id:d.id,ok:true});else{d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,timestamp:d.timestamp,pixels:{brightness:130,sharpness:80}}});}};`,
    });
  });
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByRole('alert')).toContainText('interrompu');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await expect.poll(() => trackStates(page)).toEqual(['ended', 'live']);
});

test('navigating Live to guided scan starts a separate camera session', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await inFlight(page);
  await page.getByRole('link', { name: 'Commencer', exact: true }).click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole('button', { name: 'Activer la caméra' })).toBeVisible();
  await expect.poll(() => trackStates(page)).toEqual(['ended']);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
});

test('stopping clears rendered Canvas pixels and keeps them clear after controls change', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await trackCameras(page);
  await delayedWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  const hasPixels = () =>
    page.locator('.media-coordinate canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value) => value !== 0);
    });
  expect(await hasPixels()).toBe(true);
  await page.getByRole('button', { name: 'Arrêter', exact: true }).click();
  await expect.poll(hasPixels).toBe(false);
  await page.getByRole('button', { name: 'Repères', exact: true }).click();
  expect(await hasPixels()).toBe(false);
});
