import { expect, test } from '@playwright/test';
import path from 'node:path';
import { placeReferenceProfile } from './profile-helpers';

test('confirmed profile survives viewport changes and undoes one real point drag at a time', async ({
  page,
}) => {
  await page.goto('/profile');
  await page
    .getByLabel('Importer une photo de profil', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/capone-profile.jpg'));
  await placeReferenceProfile(page, false);
  const confirmation = page.getByRole('checkbox', { name: /Je confirme une vue latérale/ });
  const submit = page.getByRole('button', { name: 'Valider et voir le rapport' });
  const undo = page.getByRole('button', { name: 'Annuler', exact: true });
  const editor = page.locator('.profile-editor');

  await page.getByLabel('Zoom du profil').fill('2');
  await page.getByRole('button', { name: 'Placer les repères', exact: true }).click();
  const initialTransform = await editor.locator('g[transform]').getAttribute('transform');
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 15, { steps: 4 });
  await page.mouse.up();
  await expect(editor.locator('g[transform]')).not.toHaveAttribute('transform', initialTransform!);
  await expect(confirmation).toBeChecked();
  await expect(submit).toBeEnabled();
  await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
  await expect(confirmation).toBeChecked();
  await undo.click();
  await expect(
    page.getByRole('spinbutton', { name: 'Bas du menton Y (%)', exact: true }),
  ).toHaveValue('50');
  await expect(confirmation).not.toBeChecked();

  await page.getByRole('spinbutton', { name: 'Bas du menton Y (%)', exact: true }).fill('63.333');
  await confirmation.check();
  await page.getByRole('button', { name: 'Déplacer la photo', exact: true }).click();
  await page.getByRole('button', { name: /^1\. Racine du nez/ }).click();
  const x = page.getByRole('spinbutton', { name: 'Racine du nez X (%)', exact: true });
  const initialX = await x.inputValue();
  const point = editor.locator('[data-point="nasion"]');
  const pointBox = (await point.boundingBox())!;
  const startX = pointBox.x + pointBox.width / 2;
  const startY = pointBox.y + pointBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 15, startY + 10, { steps: 5 });
  await page.mouse.up();
  await expect(x).not.toHaveValue(initialX);
  await expect(confirmation).not.toBeChecked();
  await undo.click();
  await expect(x).toHaveValue(initialX);
  await undo.click();
  await page.getByRole('button', { name: /^7\. Bas du menton/ }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Bas du menton Y (%)', exact: true }),
  ).toHaveValue('50');
});
