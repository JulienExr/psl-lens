import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('_'))
      .map((e) => (e.isDirectory() ? files(`${directory}/${e.name}`) : [`${directory}/${e.name}`])),
  );
  return groups.flat().filter((p) => !p.endsWith('/sw.js'));
}
const paths = await files('dist');
const hash = createHash('sha256');
for (const path of paths) hash.update(await readFile(path));
const version = hash.digest('hex').slice(0, 12);
const urls = paths.map((p) => p.slice(4));
const source = `/* Generated static-only cache. No photos, videos, landmarks or arbitrary requests. */
const CACHE = 'psl-lens-${version}';
const URLS = ${JSON.stringify(urls)};
const ALLOWED = new Set(URLS);
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('psl-lens-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin) return;
  if(request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match('/index.html', {ignoreVary:true})) || fetch(request))); return;
  }
  if(!ALLOWED.has(url.pathname) || url.search) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, {ignoreVary:true})) || fetch(request)));
});
`;
await writeFile('dist/sw.js', source);
console.log(
  `PWA: ${urls.length} static assets, version ${version}. Updates activate after all existing tabs close.`,
);
