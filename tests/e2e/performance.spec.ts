import { test, expect } from '@playwright/test';
import { fixtureDetection } from '../fixtures/face';
import { mkdir, writeFile } from 'node:fs/promises';

test('compare full-mesh SVG commits with imperative Canvas drawing on the same frames', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async (base) => {
    // Exercise the actual components in the Vite development build. These are
    // main-thread CPU/layout timings, not GPU paint or mobile-device benchmarks.
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const syncPath = '/node_modules/.vite/deps/react-dom.js';
    const meshPath = '/src/components/Mesh.tsx';
    const canvasPath = '/src/components/LiveMesh.tsx';
    const reactModule = await import(reactPath);
    const React = reactModule.default ?? reactModule;
    const domModule = await import(domPath);
    const { createRoot } = domModule.default ?? domModule;
    const syncModule = await import(syncPath);
    const { flushSync } = syncModule.default ?? syncModule;
    const { Mesh } = await import(meshPath);
    const { LiveMesh } = await import(canvasPath);
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;top:0;left:0;width:390px;height:${(390 * base.height) / base.width}px;z-index:9999;color:#62e5c0`;
    document.body.append(host);
    const root = createRoot(host);
    const ref = React.createRef();
    const frames = Array.from({ length: 140 }, (_, n) => ({
      ...base,
      faces: [base.faces[0].map((p) => ({ ...p, x: p.x + Math.sin(n / 8) * 0.001 }))],
    }));
    const samples: Record<string, number[]> = { svg: [], canvas: [] };
    const nodes: Record<string, number> = {};
    // Alternate the order, retain 120 frames after 20 warm-ups in each pass.
    for (const kind of ['svg', 'canvas', 'canvas', 'svg']) {
      flushSync(() =>
        root.render(kind === 'canvas' ? React.createElement(LiveMesh, { ref }) : null),
      );
      for (let i = 0; i < frames.length; i++) {
        const start = performance.now();
        if (kind === 'svg')
          flushSync(() => root.render(React.createElement(Mesh, { result: frames[i] })));
        else ref.current.draw(frames[i]);
        host.firstElementChild!.getBoundingClientRect();
        if (i >= 20) samples[kind].push(performance.now() - start);
      }
      nodes[kind] = host.querySelectorAll('*').length;
      await new Promise(requestAnimationFrame);
    }
    flushSync(() => root.unmount());
    host.remove();
    const stats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        frames: values.length,
        medianMs: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      };
    };
    return {
      browser: navigator.userAgent,
      viewport: 390,
      source: [base.width, base.height],
      svg: stats(samples.svg),
      canvas: stats(samples.canvas),
      nodes,
      method:
        'Vite development build; CPU update + forced layout; excludes GPU paint, inference and physical mobile hardware',
    };
  }, fixtureDetection());
  expect(result.nodes.svg).toBeGreaterThan(2500);
  expect(result.nodes.canvas).toBe(1);
  expect(result.svg.frames).toBe(240);
  expect(result.canvas.frames).toBe(240);
  console.log(JSON.stringify(result));
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/overlay-performance.json', JSON.stringify(result, null, 2));
});
