import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function exampleDataset() {
  const reference = JSON.parse(
    await readFile(resolve(root, 'tests/fixtures/annotations/capone-profile.json'), 'utf8'),
  );
  const observed = reference.points;
  const synthetic = [-2, -1, 0, 1, 2].map((offset) => ({
    id: `conditional-declaration-offset-${offset}px`,
    kind: 'synthetic-sensitivity',
    method: 'manual',
    detected: null,
    referenceRelation: 'synthetic-derived',
    strictProfileConfirmed: true,
    note: `Synthetic point perturbation ${offset}px; hypothetical user declaration of strict profile only. Exact photographic yaw remains unknown.`,
    points: Object.fromEntries(
      Object.entries(observed).map(([id, point], index) => [
        id,
        {
          ...point,
          x: point.x + (index % 2 === 0 ? offset : -offset) / reference.width,
          y: point.y + (((index % 3) - 1) * offset) / reference.height,
        },
      ]),
    ),
  }));
  return {
    schema: 'psl-profile-evaluation-1.0.0',
    metadata: {
      name: 'One historical public-domain profile: workflow and synthetic sensitivity only',
      source: reference.source,
      license: reference.license,
      consent:
        'Historical public-domain government photograph; no contemporary participant consent or consenting repeated-acquisition cohort is claimed.',
    },
    notes: [
      ...reference.notes,
      reference.orientation,
      'One image and one manual operator; annotations are not expert ground truth.',
      'The real example does not confirm strict 90 degrees: all profile measurements remain unavailable.',
      'Synthetic samples alone simulate strict-profile user declaration to inspect geometry sensitivity; they do not validate image pose, repeat annotation, repeat acquisition, or a detector.',
    ],
    cases: [
      {
        id: reference.image,
        width: reference.width,
        height: reference.height,
        side: reference.side,
        referenceType: reference.referenceType,
        reference: {
          ...Object.fromEntries(
            Object.entries(observed).map(([id, p]) => [id, { x: p.x, y: p.y, visible: true }]),
          ),
          cervical: { visible: false },
        },
        observations: [
          {
            id: 'manual-reference-self-comparison',
            kind: 'annotation',
            method: 'manual',
            detected: null,
            referenceRelation: 'self',
            strictProfileConfirmed: false,
            note: 'Same coordinates as reference: zero point error is a self comparison, not independent accuracy.',
            points: observed,
          },
          ...synthetic,
        ],
      },
    ],
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Usage: node scripts/evaluate-profile.mjs [dataset.json] [--output report.json]\nNo dataset: one public-domain historical image, manual self comparison and explicitly synthetic sensitivity.\nCustom dataset format: docs/validation-v2.md. No image inference or network requests.',
    );
    return;
  }
  let datasetPath, outputPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--output requires a path');
      outputPath = args[++i];
    } else if (!args[i].startsWith('-') && !datasetPath) datasetPath = args[i];
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  const dataset = datasetPath
    ? JSON.parse(await readFile(resolve(datasetPath), 'utf8'))
    : await exampleDataset();
  // Compile in memory with the repository's existing esbuild; no generated files or dependencies.
  const bundle = await build({
    entryPoints: [resolve(root, 'src/validation/profile-evaluation.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  const { evaluateProfileDataset } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
  const output = `${JSON.stringify(evaluateProfileDataset(dataset), null, 2)}\n`;
  if (outputPath) await writeFile(resolve(outputPath), output);
  else process.stdout.write(output);
}

main().catch((error) => {
  console.error(`Profile evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
