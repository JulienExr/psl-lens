import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fixtureDetection } from '../fixtures/face';

async function poorCaptureWorker(page: Page) {
  const fixture = fixtureDetection(22);
  await page.route('**/vision-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const base=${JSON.stringify(fixture)};self.onmessage=e=>{const d=e.data;if(d.type==='init'){self.postMessage({id:d.id,ok:true});return;}d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,timestamp:d.timestamp,pixels:{brightness:25,sharpness:2}}});};`,
    }),
  );
}

test('poor photo quality warns but does not prevent reaching a numeric score', async ({ page }) => {
  await poorCaptureWorker(page);
  await page.goto('/photo');
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(page.getByRole('button', { name: 'Découvrir mon rapport' })).toBeEnabled();
  await expect(page.getByText(/Estimation disponible/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Découvrir mon rapport' }).click();
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveText(/^\d\.\d{2}$/);
  await expect(page.locator('.score-reasons')).toContainText('floue');
  await expect(page.locator('.score-reliability')).toContainText('Fiabilité limitée');
});

test('Live can create an indicative score from its first measurable poor-quality frame', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await poorCaptureWorker(page);
  await page.goto('/live');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(page.getByRole('button', { name: 'Créer mon rapport' })).toBeEnabled();
  await page.getByRole('button', { name: 'Créer mon rapport' }).click();
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveText(/^\d\.\d{2}$/);
  await expect(page.locator('.score-reliability')).toContainText('Fiabilité limitée');
});

test('guided scan offers an immediate estimate even when quality prevents stabilization', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera']);
  await poorCaptureWorker(page);
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await page
    .getByRole('button', { name: 'Voir mon estimation maintenant' })
    .click({ timeout: 2000 });
  await expect(page.getByLabel('Score PSL frontal expérimental')).toHaveText(/^\d\.\d{2}$/);
  await expect(page.locator('.score-reliability')).toContainText('Fiabilité limitée');
  await expect(page.getByText('Continuité géométrique cohérente')).toHaveCount(0);
});
