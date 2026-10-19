import { test, expect } from '@playwright/test';
import { fixtureDetection } from '../fixtures/face';

for (const [width, height] of [
  [480, 640],
  [640, 360],
]) {
  test(`Live source ${width}×${height} preserves the video/Canvas mapping at all target widths`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ width, height }) => {
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d')!;
          const draw = () => {
            context.fillStyle = '#777';
            context.fillRect(0, 0, width, height);
          };
          draw();
          setInterval(draw, 80);
          return canvas.captureStream(12);
        };
      },
      { width, height },
    );
    const fixture = fixtureDetection();
    await page.route('**/vision-worker.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `const base=${JSON.stringify(fixture)};self.onmessage=e=>{const d=e.data;if(d.type==='init'){self.postMessage({id:d.id,ok:true});return;}const width=d.bitmap.width,height=d.bitmap.height;d.bitmap.close();self.postMessage({id:d.id,ok:true,result:{...base,width,height,timestamp:d.timestamp,pixels:{brightness:130,sharpness:80}}});};`,
      }),
    );
    await page.goto('/live');
    await page.getByRole('button', { name: 'Activer la caméra' }).click();
    await expect(page.getByText('Visage détecté', { exact: true })).toBeVisible();
    for (const viewportWidth of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({
        width: viewportWidth,
        height: viewportWidth === 768 ? 390 : 900,
      });
      await expect
        .poll(() =>
          page.locator('.media-coordinate').evaluate((el) => {
            const video = el.querySelector('video')!,
              canvas = el.querySelector('canvas')!;
            const v = video.getBoundingClientRect(),
              c = canvas.getBoundingClientRect();
            return Math.max(
              Math.abs(v.width / v.height - video.videoWidth / video.videoHeight),
              Math.abs(c.width - v.width),
              Math.abs(c.height - v.height),
              Math.abs(canvas.width / canvas.height - video.videoWidth / video.videoHeight),
            );
          }),
        )
        .toBeLessThan(0.01);
      expect(
        await page.locator('.media-coordinate').evaluate((el) => getComputedStyle(el).transform),
      ).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    }
    await page.getByRole('button', { name: 'Basculer le miroir' }).click();
    await expect(page.locator('.media-coordinate')).not.toHaveClass(/mirrored/);
  });
}
