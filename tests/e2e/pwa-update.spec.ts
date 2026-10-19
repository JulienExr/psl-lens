import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build as bundle } from 'esbuild';

const exec = promisify(execFile);
const generator = path.resolve('scripts/build-sw.mjs');
const runtimeFiles = [
  'vision-worker.js',
  'models/face_landmarker.task',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
];
let root: string;
let server: Server;
let origin: string;
let activeBuild: string;
let blocked: Set<string>;
let requests: string[];
let retainPrevious: boolean;

async function build(label: string, revision = label, withUI = false) {
  const directory = path.join(root, label);
  await mkdir(path.join(directory, 'dist'), { recursive: true });
  let script = "navigator.serviceWorker.register('/sw.js');";
  if (withUI) {
    const result = await bundle({
      stdin: {
        contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {OfflineStatus} from './src/components/OfflineStatus'; createRoot(document.getElementById('status')).render(React.createElement(OfflineStatus));`,
        resolveDir: process.cwd(),
        loader: 'tsx',
      },
      bundle: true,
      write: false,
      format: 'iife',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    script += result.outputFiles[0].text;
  }
  const files: Record<string, string> = {
    'index.html': `<h1>Shell ${label}</h1><div id="status"></div><script src="/shell.js"></script>`,
    'shell.js': script,
  };
  for (const file of runtimeFiles) files[`vision/${revision}/${file}`] = `${revision}:${file}`;
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, 'dist', file)), { recursive: true });
    await writeFile(path.join(directory, 'dist', file), content);
  }
  await exec(process.execPath, [generator], { cwd: directory });
  return directory;
}

async function controlled(page: Page) {
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

async function status(page: Page, revision: string, variant = 'simd') {
  return page.evaluate(
    ({ revision, variant }) =>
      new Promise<{ ready: boolean; missing: string[] }>((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => reject(new Error('No cache status reply')), 1500);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          resolve(event.data);
        };
        navigator.serviceWorker.controller!.postMessage(
          { type: 'PSL_CACHE_STATUS', revision, variant },
          [channel.port2],
        );
      }),
    { revision, variant },
  );
}

async function warm(page: Page, revision: string) {
  const files = runtimeFiles.filter((file) => !file.includes('nosimd'));
  for (const file of files)
    expect(
      await page.evaluate(async (url) => (await fetch(url)).ok, `/vision/${revision}/${file}`),
    ).toBe(true);
  await expect.poll(async () => (await status(page, revision)).ready).toBe(true);
}

test.beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'psl-pwa-'));
  blocked = new Set();
  requests = [];
  retainPrevious = false;
  activeBuild = await build('a');
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname;
    requests.push(request.url!);
    response.setHeader('Cache-Control', 'no-store');
    if (blocked.has(pathname)) {
      response.writeHead(503).end('Temporarily unavailable');
      return;
    }
    // Explicitly opt into retention only for the test documenting that host guarantee.
    const roots =
      retainPrevious && pathname.startsWith('/vision/')
        ? [activeBuild, path.join(root, 'a')]
        : [activeBuild];
    for (const directory of roots) {
      try {
        const bytes = await readFile(
          path.join(directory, 'dist', pathname === '/' ? 'index.html' : pathname),
        );
        response.setHeader(
          'Content-Type',
          pathname.endsWith('.js')
            ? 'text/javascript'
            : pathname === '/' || pathname.endsWith('.html')
              ? 'text/html'
              : 'application/octet-stream',
        );
        response.end(bytes);
        return;
      } catch {
        /* Try the retained immutable build. */
      }
    }
    response.writeHead(404).end('Not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(root, { recursive: true, force: true });
});

test('shell installs without requesting unavailable vision assets', async ({ page, context }) => {
  blocked.add('/vision/a/models/face_landmarker.task');
  await controlled(page);
  expect(requests.filter((url) => url.startsWith('/vision/'))).toEqual([]);
  expect((await status(page, 'a')).ready).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shell a' })).toBeVisible();
});

test('only requested static vision files persist and become available offline', async ({
  page,
  context,
}) => {
  await controlled(page);
  await warm(page, 'a');
  expect((await status(page, 'a', 'nosimd')).ready).toBe(false);
  await page.evaluate(async () => {
    await fetch('/private-photo.jpg');
    await fetch('/vision/a/vision-worker.js?photo=private');
    await fetch('/vision/a/vision-worker.js', { method: 'POST', body: 'private' });
  });
  const stored = await page.evaluate(async () => {
    const entries = await Promise.all(
      (await caches.keys()).map(async (key) =>
        (await (await caches.open(key)).keys()).map(
          (request) => new URL(request.url).pathname + new URL(request.url).search,
        ),
      ),
    );
    return entries.flat();
  });
  expect(stored).not.toContain('/private-photo.jpg');
  expect(stored.some((url) => url.includes('?') || url.includes('nosimd'))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  expect(
    await page.evaluate(async () => (await fetch('/vision/a/models/face_landmarker.task')).text()),
  ).toBe('a:models/face_landmarker.task');
  expect((await status(page, 'a')).ready).toBe(true);
});

test('failed progressive asset download stays incomplete and recovers on retry', async ({
  page,
}) => {
  await controlled(page);
  blocked.add('/vision/a/models/face_landmarker.task');
  expect(
    await page.evaluate(async () => (await fetch('/vision/a/models/face_landmarker.task')).status),
  ).toBe(503);
  expect((await status(page, 'a')).ready).toBe(false);
  blocked.clear();
  await warm(page, 'a');
});

test('waiting update preserves old runtime until old tabs close, then replaces caches', async ({
  page,
  context,
}) => {
  await controlled(page);
  await warm(page, 'a');
  activeBuild = await build('b');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shell a' })).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/vision/a/vision-worker.js')).text())).toBe(
    'a:vision-worker.js',
  );
  await page.close();
  const next = await context.newPage();
  await expect
    .poll(async () => {
      await next.goto(origin);
      return next.getByRole('heading', { name: 'Shell b' }).count();
    })
    .toBe(1);
  await warm(next, 'b');
  const keys = await next.evaluate(() => caches.keys());
  expect(keys.some((key) => key === 'psl-lens-vision-a')).toBe(false);
  expect((await status(next, 'a')).ready).toBe(false);
});

test('host retaining A assets lets old shell lazily fetch A while B waits', async ({ page }) => {
  retainPrevious = true;
  await controlled(page);
  activeBuild = await build('b');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
    )
    .toBe(true);
  expect(await page.evaluate(async () => (await fetch('/vision/a/vision-worker.js')).text())).toBe(
    'a:vision-worker.js',
  );
  await warm(page, 'a');
  expect((await status(page, 'b')).ready).toBe(false);
});

test('replacement without A assets recovers through explicit update UI and clears in-memory session', async ({
  page,
  context,
}) => {
  activeBuild = await build('a', 'a', true);
  await controlled(page);
  const observer = await context.newPage();
  await observer.goto(origin);
  await observer.evaluate(() =>
    Reflect.set(window, 'privateSession', { image: 'another-tab-memory-only' }),
  );
  await page.evaluate(() =>
    Reflect.set(window, 'privateSession', { image: 'synthetic-memory-only' }),
  );
  activeBuild = await build('b', 'b', true);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
    )
    .toBe(true);
  expect(await page.evaluate(async () => (await fetch('/vision/a/vision-worker.js')).status)).toBe(
    404,
  );
  await expect(page.getByRole('heading', { name: 'Shell a' })).toBeVisible();
  expect(await page.evaluate(() => Reflect.has(window, 'privateSession'))).toBe(true);
  await expect(page.getByText(/photo.*résultats.*session/i)).toBeVisible();
  await page.getByRole('button', { name: 'Mettre à jour et effacer la session' }).click();
  await expect(page.getByRole('heading', { name: 'Shell b' })).toBeVisible();
  expect(await page.evaluate(() => Reflect.has(window, 'privateSession'))).toBe(false);
  await expect(observer.getByRole('heading', { name: 'Shell a' })).toBeVisible();
  expect(await observer.evaluate(() => Reflect.has(window, 'privateSession'))).toBe(true);
  await observer.getByRole('button', { name: 'Recharger et effacer la session' }).click();
  await expect(observer.getByRole('heading', { name: 'Shell b' })).toBeVisible();
  expect(await observer.evaluate(() => Reflect.has(window, 'privateSession'))).toBe(false);
  await warm(page, 'b');
});

test('a failed replacement shell leaves the current version available offline', async ({
  page,
  context,
}) => {
  await controlled(page);
  activeBuild = await build('b');
  blocked.add('/shell.js');
  await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await registration.update();
    const installing = registration.installing;
    if (installing && installing.state !== 'redundant')
      await new Promise<void>((resolve) => {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'redundant') resolve();
        });
      });
  });
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
  ).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shell a' })).toBeVisible();
});

test('asset preparation removes unused variants and versions worker with its resources', async () => {
  const source = path.join(root, 'prepare');
  const candidates = [
    'node_modules/.cache/psl-lens/face_landmarker.task',
    'public/models/face_landmarker.task',
  ];
  let model: Buffer | undefined;
  for (const candidate of candidates) {
    try {
      model = await readFile(candidate);
      break;
    } catch {
      /* Try legacy model location. */
    }
  }
  if (!model) throw new Error('Run npm ci to prepare the model fixture');
  await mkdir(path.join(source, 'public/models'), { recursive: true });
  await writeFile(path.join(source, 'public/models/face_landmarker.task'), model);
  await mkdir(path.join(source, 'src/vision'), { recursive: true });
  await writeFile(
    path.join(source, 'src/vision/worker.ts'),
    'self.onmessage = () => self.postMessage("first");',
  );
  await mkdir(path.join(source, 'node_modules/@mediapipe'), { recursive: true });
  await symlink(
    path.resolve('node_modules/@mediapipe/tasks-vision'),
    path.join(source, 'node_modules/@mediapipe/tasks-vision'),
  );
  const prepare = () =>
    exec(process.execPath, [path.resolve('scripts/prepare-assets.mjs')], { cwd: source });
  await prepare();
  expect(await readdir(path.join(source, 'src/vision'))).toContain('runtime-assets.ts');
  const manifest = await readFile(path.join(source, 'src/vision/runtime-assets.ts'), 'utf8');
  const revisions = await readdir(path.join(source, 'public/vision'));
  expect(revisions).toHaveLength(1);
  const wasm = await readdir(path.join(source, 'public/vision', revisions[0], 'wasm'));
  expect(wasm.sort()).toEqual([
    'vision_wasm_internal.js',
    'vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm',
  ]);
  expect(manifest).toContain(`/vision/${revisions[0]}/vision-worker.js`);
  await prepare();
  expect(await readdir(path.join(source, 'public/vision'))).toEqual(revisions);
  await writeFile(
    path.join(source, 'src/vision/worker.ts'),
    'self.onmessage = () => self.postMessage("changed");',
  );
  await prepare();
  const changed = await readdir(path.join(source, 'public/vision'));
  expect(changed).toHaveLength(1);
  expect(changed).not.toEqual(revisions);
});
