import { test, expect } from '@playwright/test';
import path from 'node:path';
test('real local photo inference and report on an alternate browser engine', async ({ page }) => {
  await page.goto('/photo');
  expect(
    await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2'))),
    'The test browser needs real WebGL2 image transport even for MediaPipe CPU inference',
  ).toBe(true);
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(
    page.getByText('Capture frontale exploitable. 15 mesures disponibles.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Découvrir mon rapport' }).click();
  await expect(page.locator('.measurement-card')).toHaveCount(15);
  await expect(page.getByText('PSL complet : indisponible')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Effacer la session' }).click();
  await expect(page.getByText('Votre rapport commence ici.')).toBeVisible();
});

test('assisted real profile and native PDF on alternate engines', async ({ page }) => {
  await page.goto('/profile');
  await page
    .getByLabel('Importer une photo de profil', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  const { placeReferenceProfile } = await import('./profile-helpers');
  await placeReferenceProfile(page);
  await expect(page.locator('.profile-result .measurement-card')).toHaveCount(7);
  await page.getByRole('button', { name: 'Préparer le PDF' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Inclure les photos locales' }),
  ).not.toBeChecked();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('psl-lens-rapport.pdf');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const { PDFDocument } = await import('pdf-lib');
  expect((await PDFDocument.load(Buffer.concat(chunks))).getPageCount()).toBeGreaterThan(1);
});
