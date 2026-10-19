import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { build } from 'esbuild';

const model = 'public/models/face_landmarker.task';
const expected = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
await mkdir('public/models', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/wasm', { recursive: true });
let bytes;
try {
  bytes = await readFile(model);
} catch {
  /* First install downloads the versioned model. */
}
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== expected) {
  console.log('Downloading MediaPipe face model v1 (3.6 MiB)…');
  const response = await fetch(
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    { signal: AbortSignal.timeout(120000) },
  );
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('Model checksum mismatch');
  await writeFile(model, bytes);
}
const names = [
  'TESSELATION',
  'FACE_OVAL',
  'LEFT_EYE',
  'RIGHT_EYE',
  'LEFT_EYEBROW',
  'RIGHT_EYEBROW',
  'LIPS',
  'LEFT_IRIS',
  'RIGHT_IRIS',
];
const connections = Object.fromEntries(
  names.map((name) => [name, FaceLandmarker[`FACE_LANDMARKS_${name}`]]),
);
await mkdir('src/vision', { recursive: true });
await writeFile('src/vision/connections.json', JSON.stringify(connections));
await build({
  entryPoints: ['src/vision/worker.ts'],
  outfile: 'public/vision-worker.js',
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
});
console.log('Local model, WASM and official mesh connections ready.');
