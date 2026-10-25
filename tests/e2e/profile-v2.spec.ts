import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { placeReferenceProfile as place } from './profile-helpers';
test('real lateral photo → assisted points → profile-only report → private native PDF and erase', async ({
  page,
}, testInfo) => {
  const remote: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:5173') && !r.url().startsWith('data:'))
      remote.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profile');
  await page
    .getByLabel('Importer une photo de profil', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  await expect(page.getByRole('button', { name: 'Valider et voir le rapport' })).toBeDisabled();
  // Real pointer placement, undo and zoom before precise numeric manual annotation.
  const editor = page.locator('.profile-editor');
  const box = (await editor.boundingBox())!;
  await editor.click({ position: { x: box.width * 0.5, y: box.height * 0.3 } });
  await expect(
    page.getByRole('spinbutton', { name: 'Racine du nez X (%)', exact: true }),
  ).not.toHaveValue('');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Racine du nez X (%)', exact: true }),
  ).toHaveValue('');
  await page.getByLabel('Zoom du profil').fill('2');
  await page.getByRole('button', { name: 'Placer les repères', exact: true }).click();
  const before = await page.locator('.profile-editor').evaluate((el) => {
    const matrix = (el as unknown as SVGSVGElement).getScreenCTM()!;
    const group = el.querySelector('g[transform]')!;
    return { scale: matrix.a, transform: group.getAttribute('transform')! };
  });
  const panBox = (await editor.boundingBox())!;
  await page.mouse.move(panBox.x + panBox.width / 2, panBox.y + panBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(panBox.x + panBox.width / 2 + 20, panBox.y + panBox.height / 2 + 15);
  await page.mouse.up();
  const after = await page.locator('.profile-editor g[transform]').getAttribute('transform');
  const initialTranslation = Number(before.transform.match(/translate\(([-\d.]+)/)![1]);
  const finalTranslation = Number(after!.match(/translate\(([-\d.]+)/)![1]);
  expect(finalTranslation - initialTranslation).toBeCloseTo(20 / before.scale, 3);
  await page.getByRole('button', { name: 'Déplacer la photo', exact: true }).click();
  await page.getByLabel('Zoom du profil').fill('1.5');
  await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
  await place(page);
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByRole('heading', { name: 'Votre profil, en perspective.' })).toBeVisible();
  await expect(page.locator('.profile-result .measurement-card')).toHaveCount(7);
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveCount(0);
  await expect(page.getByText('Complétez les vues pour cette estimation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('checkbox', { name: 'Afficher la notation esthétique', exact: true })
    .uncheck();
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter les mesures' }).click();
  const json = await jsonEvent;
  const jsonPath = testInfo.outputPath('profile.json');
  await json.saveAs(jsonPath);
  const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  expect(data.schema).toBe('psl-report-2.0.0');
  expect(data.profiles).toHaveLength(1);
  expect(
    data.profiles[0].measurements.filter((m: { value: number | null }) => m.value !== null),
  ).toHaveLength(6);
  expect(data.profiles[0].preview).toBeUndefined();
  expect(data.frontalScore).toBeUndefined();
  expect(data.multiviewScore).toBeUndefined();
  await page.getByRole('button', { name: 'Préparer le PDF' }).click();
  await expect(
    page.getByRole('checkbox', { name: /Inclure les photos locales/ }),
  ).not.toBeChecked();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: /Télécharger le PDF/ }).click();
  const pdf = await event;
  const pdfPath = testInfo.outputPath('profile-private.pdf');
  await pdf.saveAs(pdfPath);
  const pdfDocument = await PDFDocument.load(await fs.readFile(pdfPath));
  expect(pdfDocument.getPageCount()).toBeGreaterThan(1);
  const countImages = (doc: PDFDocument) =>
    doc.context
      .enumerateIndirectObjects()
      .filter(
        ([, object]) =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image',
      ).length;
  expect(countImages(pdfDocument)).toBe(0);
  await page.getByRole('checkbox', { name: /Inclure les photos locales/ }).check();
  const withPhotoEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: /Télécharger le PDF/ }).click();
  const withPhoto = await withPhotoEvent;
  const withPhotoPath = testInfo.outputPath('profile-with-photo.pdf');
  await withPhoto.saveAs(withPhotoPath);
  expect(countImages(await PDFDocument.load(await fs.readFile(withPhotoPath)))).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('profile-report-mobile.png'), fullPage: true });
  expect(remote).toEqual([]);
  await page.getByRole('button', { name: 'Effacer la session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre rapport commence ici.' })).toBeVisible();
});
test('real frontal and lateral imports contribute separately to a multiview report', async ({
  page,
}) => {
  await page.goto('/photo');
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(page.getByRole('button', { name: 'Découvrir mon rapport' })).toBeEnabled();
  await page
    .getByLabel('Photo de profil facultative')
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel('Côté anatomique observé').selectOption('left');
  await place(page);
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveText(/^\d\.\d{2}$/);
  const multi = page.locator('.v2-report .scoring-panel');
  await expect(multi.getByRole('heading')).toHaveText(/^\d\.\d{2} \/ 8$/);
  await expect(multi).toContainText('psl-multiview-2.0.0');
  await expect(page.locator('.v2-report')).toContainText('profile-left');
  await page.getByRole('button', { name: 'Ouvrir l’explorateur géométrique' }).click();
  await expect(page.getByText(/Géométrie faciale relative estimée/).first()).toBeVisible();
});
test('Advanced Scan captures only on explicit action and hands its local photo to assisted editor', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await page.goto('/advanced');
  await expect(page.locator('video')).toHaveJSProperty('srcObject', null);
  await page.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Capturer une photo latérale' })).toBeEnabled();
  await page.getByRole('button', { name: 'Capturer une photo latérale' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('.profile-editor image')).toHaveAttribute('href', /^data:image\/jpeg/);
  await expect(page.getByRole('button', { name: 'Valider et voir le rapport' })).toBeDisabled();
});

test('completed Advanced Scan preserves actual front and oblique views through alternative profile import', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  const { fixtureDetection } = await import('../fixtures/face');
  const fixture = fixtureDetection();
  await page.route('**/vision-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `let count=0;const base=${JSON.stringify(fixture)};self.onmessage=e=>{const d=e.data;if(d.type==='init'){self.postMessage({id:d.id,ok:true});return;}count++;const yaw=count<=40?0:count<=70?22:-22;d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,timestamp:d.timestamp,pose:{yaw,pitch:0,roll:0,source:'matrix'},pixels:{brightness:130,sharpness:80}}});};`,
    }),
  );
  await page.goto('/advanced');
  await page.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Les vues automatiques sont acquises.' }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Passez au profil latéral' })).toBeVisible();
  await page.getByRole('button', { name: 'Importer un profil à la place', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page
    .getByLabel('Importer une photo de profil', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  await place(page);
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveText(/^\d\.\d{2}$/);
  await expect(page.locator('.report-summary')).toContainText('32');
  await expect(page.locator('.v2-report')).toContainText('oblique-left');
  await expect(page.locator('.v2-report')).toContainText('oblique-right');
});

test('replacement image decoding prevents submission of the previously confirmed profile', async ({
  page,
}) => {
  await page.goto('/profile');
  await page
    .getByLabel('Importer une photo de profil', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  await place(page, false);
  await page.evaluate(() => {
    const original = window.createImageBitmap;
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      if (args[0] instanceof File && args[0].name === 'replacement.jpg')
        await new Promise<void>((resolve) => {
          (window as unknown as { releaseDecode: () => void }).releaseDecode = resolve;
        });
      return original(...args);
    }) as typeof createImageBitmap;
  });
  await page.getByLabel('Importer une photo de profil', { exact: true }).setInputFiles({
    name: 'replacement.jpg',
    mimeType: 'image/jpeg',
    buffer: await fs.readFile('tests/fixtures/capone-profile.jpg'),
  });
  await expect(page.getByRole('button', { name: 'Valider et voir le rapport' })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseDecode: () => void }).releaseDecode());
  await expect(page.getByText('Lecture locale…')).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: /Je confirme une vue latérale/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Valider et voir le rapport' })).toBeDisabled();
});
