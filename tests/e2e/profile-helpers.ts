import { expect, type Page } from '@playwright/test';
import reference from '../fixtures/annotations/capone-profile.json' with { type: 'json' };
export async function placeReferenceProfile(page: Page, submit = true) {
  const names = [
    'Racine du nez',
    'Pointe du nez',
    'Base du nez',
    'Lèvre supérieure',
    'Lèvre inférieure',
    'Avant du menton',
    'Bas du menton',
  ];
  for (const [i, p] of Object.values(reference.points).entries()) {
    await page.locator('.profile-point-list button').nth(i).click();
    for (const axis of ['x', 'y'] as const)
      await page
        .getByRole('spinbutton', { name: `${names[i]} ${axis.toUpperCase()} (%)`, exact: true })
        .fill(String(p[axis] * 100));
  }
  await page.getByRole('checkbox', { name: /Je confirme une vue latérale/ }).check();
  await expect(page.getByRole('button', { name: 'Valider et voir le rapport' })).toBeEnabled();
  if (submit) await page.getByRole('button', { name: 'Valider et voir le rapport' }).click();
}
