import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('_'))
      .map((entry) =>
        entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
      ),
  );
  return groups
    .flat()
    .filter((file) => !file.endsWith('/sw.js'))
    .sort();
}
const paths = await files('dist');
const hash = createHash('sha256').update(await readFile(new URL(import.meta.url)));
let shellBytes = 0;
let runtimeBytes = 0;
for (const path of paths) {
  const bytes = await readFile(path);
  hash.update(path).update(bytes);
  if (path.startsWith('dist/vision/')) runtimeBytes += bytes.length;
  else shellBytes += bytes.length;
}
const version = hash.digest('hex').slice(0, 16);
const urls = paths.map((path) => path.slice(4));
const shell = urls.filter((url) => !url.startsWith('/vision/'));
const runtime = urls.filter((url) => url.startsWith('/vision/'));
const revisions = [...new Set(runtime.map((url) => url.split('/')[2]))];
const source = `/* Generated static-only caches. No photos, videos, landmarks or arbitrary requests. */
const SHELL = 'psl-lens-shell-${version}';
const SHELL_URLS = ${JSON.stringify(shell)};
const RUNTIME_URLS = ${JSON.stringify(runtime)};
const REVISIONS = ${JSON.stringify(revisions)};
const ALLOWED = new Set([...SHELL_URLS, ...RUNTIME_URLS]);
const pending = new Map();
function cacheName(pathname) {
  return pathname.startsWith('/vision/') ? 'psl-lens-vision-' + pathname.split('/')[2] : SHELL;
}
self.addEventListener('install', event => {
  // The shell has no dependency on downloading a model or a WASM engine.
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_URLS)));
});
self.addEventListener('activate', event => {
  const retained = new Set([SHELL, ...REVISIONS.map(revision => 'psl-lens-vision-' + revision)]);
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('psl-lens-') && !retained.has(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function asset(request, pathname) {
  const cache = await caches.open(cacheName(pathname));
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  if (!pending.has(pathname)) {
    const operation = (async () => {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        // A quota failure must not discard a usable online response.
        try { await cache.put(request, response.clone()); } catch { /* Readiness stays false. */ }
      }
      return response;
    })();
    pending.set(pathname, operation);
    operation.finally(() => pending.delete(pathname)).catch(() => {});
  }
  return (await pending.get(pathname)).clone();
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(SHELL).then(async cache => (await cache.match('/index.html', { ignoreVary: true })) || fetch(request)));
    return;
  }
  if (!ALLOWED.has(url.pathname) || url.search) return;
  const response = asset(request, url.pathname);
  event.respondWith(response);
  event.waitUntil(response.then(() => {}, () => {}));
});
self.addEventListener('message', event => {
  const { type, revision, variant } = event.data || {};
  if (type === 'PSL_ACTIVATE_UPDATE') {
    // Only an explicit UI action asks a waiting version to replace open clients.
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type !== 'PSL_CACHE_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const base = '/vision/' + revision;
    const suffix = variant === 'nosimd' ? '_nosimd' : '';
    const required = [base + '/vision-worker.js', base + '/models/face_landmarker.task', base + '/wasm/vision_wasm' + suffix + '_internal.js', base + '/wasm/vision_wasm' + suffix + '_internal.wasm'];
    let missing = required;
    if (REVISIONS.includes(revision) && ['simd', 'nosimd'].includes(variant)) {
      const name = 'psl-lens-vision-' + revision;
      if (await caches.has(name)) {
        const cache = await caches.open(name);
        missing = (await Promise.all(required.map(async url => (await cache.match(url, { ignoreVary: true })) ? null : url))).filter(Boolean);
      }
    }
    event.ports[0].postMessage({ type, revision, ready: missing.length === 0, missing });
  })());
});
`;
await writeFile('dist/sw.js', source);
console.log(
  `PWA: ${shell.length} shell files (${shellBytes} bytes), ${runtime.length} progressive vision files (${runtimeBytes} bytes), version ${version}. Updates wait for old tabs to close or an explicit reload action.`,
);
