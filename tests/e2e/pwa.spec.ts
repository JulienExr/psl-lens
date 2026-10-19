import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
test('production CSP, real inference, static-only PWA cache and offline shell', async ({
  page,
  context,
}) => {
  const headers = await readFile('public/_headers', 'utf8');
  const csp = headers
    .split('\n')
    .find((s) => s.includes('Content-Security-Policy:'))!
    .split('Content-Security-Policy:')[1]
    .trim();
  await page.route('http://127.0.0.1:4173/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'Content-Security-Policy': csp },
    });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await page.getByRole('link', { name: 'Analyze a Photo', exact: true }).click();
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(page.getByText('Capture frontale exploitable. 15 mesures disponibles.')).toBeVisible(
    { timeout: 60000 },
  );
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('psl-lens-'))!);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(urls).toContain('/models/face_landmarker.task');
  expect(urls).toContain('/vision-worker.js');
  expect(
    urls.every(
      (u) =>
        /^\/(assets|models|wasm|icons)\//.test(u) ||
        ['/index.html', '/vision-worker.js', '/manifest.webmanifest'].includes(u),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Effacer la session' }).click();
  await page.unroute('http://127.0.0.1:4173/');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Votre photo, décryptée.' })).toBeVisible();
  await page
    .getByLabel('Photo de face', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/einstein.jpg'));
  await expect(page.getByText('Capture frontale exploitable. 15 mesures disponibles.')).toBeVisible(
    { timeout: 60000 },
  );
});
