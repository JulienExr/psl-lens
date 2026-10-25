import { expect, it } from 'vitest';
import { scoreMultiview } from '../../src/scoring/multiview';
import { analyzeProfile } from '../../src/morphometry/profile';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { aggregate } from '../../src/vision/temporal';
import { measure } from '../../src/morphometry/metrics';
const d = fixtureDetection();
const front = () =>
  aggregate(
    [
      {
        detection: d,
        quality: readyQuality,
        measurements: measure(d, readyQuality),
        stage: 'front',
      },
    ],
    'photo',
  );
const points = Object.fromEntries(
  Object.entries({
    nasion: [0.4, 0.2],
    pronasale: [0.6, 0.4],
    subnasale: [0.45, 0.45],
    pogonion: [0.48, 0.65],
    menton: [0.4, 0.75],
  }).map(([k, [x, y]]) => [k, { x, y, confirmed: true, source: 'manual' as const }]),
);
const profile = () =>
  analyzeProfile({
    points,
    width: 1000,
    height: 1000,
    side: 'left',
    strictProfileConfirmed: true,
    source: 'import',
  });
it('keeps multiview conditional without removing the frontal score', () => {
  const f = front();
  expect(scoreMultiview(f, []).score).toBeNull();
  expect(f.frontalScore.score).not.toBeNull();
  expect(scoreMultiview(null, [profile()]).score).toBeNull();
});
it('uses separate versioned contributions adding to its bounded score', () => {
  const a = scoreMultiview(front(), [profile()]);
  expect(a.version).toBe('psl-multiview-2.0.0');
  expect(a.score).toBeGreaterThanOrEqual(0);
  expect(a.score).toBeLessThanOrEqual(8);
  expect(a.categories.reduce((s, c) => s + (c.contribution ?? 0), 0)).toBeCloseTo(a.score!);
  expect(a.reliability).toBe('limited');
});
it('excludes duplicate invalid or unvalidated profile measurements and never merges sides', () => {
  const p = profile(),
    f = front();
  p.measurements.push({ ...p.measurements[0] });
  const a = scoreMultiview(f, [p]);
  expect(a.coverage).toBeLessThan(1);
  expect(a.categories.find((c) => c.id === 'nose-projection')?.score).toBeNull();
  p.quality.valid = false;
  expect(scoreMultiview(f, [p]).score).toBeNull();
});
it('chooses one complete profile deterministically and records its provenance', () => {
  const p = profile(),
    other = profile();
  p.createdAt = '2026-01-01';
  other.createdAt = '2026-02-01';
  expect(scoreMultiview(front(), [p, other]).profileSourceId).toBe(other.id);
  expect(scoreMultiview(front(), [other, p]).profileSourceId).toBe(other.id);
});
