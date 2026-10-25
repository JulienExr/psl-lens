import { describe, expect, it } from 'vitest';
import * as scoring from '../../src/scoring';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { measure } from '../../src/morphometry/metrics';
import type { CaptureQuality, FacePose, FrontalPSLResult, Measurement } from '../../src/types';

const photo = { source: 'photo' as const, quality: readyQuality, pose: fixtureDetection().pose };
const series = { ...photo, source: 'live' as const };
const targets: Record<string, number> = {
  'face-ratio': 0.78,
  'lower-face': 0.4,
  'eye-spacing': 1,
  'canthal-tilt': 4,
  symmetry: 0,
  'jaw-ratio': 0.78,
  'chin-ratio': 0.2,
};
const inputs = (source: 'photo' | 'live' = 'photo'): Measurement[] =>
  measure(fixtureDetection(), readyQuality).map((m) => ({
    ...m,
    value: targets[m.id] ?? m.value,
    samples: source === 'photo' ? 1 : 8,
    confidence: source === 'photo' ? 'low' : 'moderate',
    ...(source === 'photo'
      ? { reliabilityReason: 'single-photo' as const }
      : { spread: 0, rawSpread: 0, retention: 1 }),
  }));
const run = (
  measurements: Measurement[],
  context: { source: 'photo' | 'live' | 'guided'; quality: CaptureQuality; pose: FacePose },
): FrontalPSLResult => scoring.scoreFrontal(measurements, context);

it('exports an explicitly separate frontal scoring protocol', () => {
  expect(scoring).toHaveProperty('scoreFrontal');
});

describe('psl-frontal-1.1.0', () => {
  it('scores a valid single photo with explicitly limited reliability', () => {
    const result = run(inputs(), photo);
    expect(result).toMatchObject({
      version: 'psl-frontal-1.1.0',
      score: 8,
      reliability: 'limited',
    });
    expect(result.categories.map((c) => c.weight)).toEqual([0.3, 0.25, 0.2, 0.25]);
    expect(result.categories.map((c) => c.contribution)).toEqual([2.4, 2, 1.6, 2]);
    expect(result.reasons.join(' ')).toContain('photo');
    expect(scoring.score(inputs()).score).toBeNull();
  });
  it('accepts stable repeated observations with moderate reliability', () => {
    expect(run(inputs('live'), series)).toMatchObject({ score: 8, reliability: 'moderate' });
  });
  it('uses a documented angular dispersion floor around a zero tilt', () => {
    const metrics = inputs('live').map((m) =>
      m.id === 'canthal-tilt' ? { ...m, value: 0, spread: 0.2, rawSpread: 0.2 } : m,
    );
    expect(run(metrics, series).score).not.toBeNull();
  });
  it('exposes partial coverage and normalizes only the measured weights', () => {
    const missing = inputs().filter((m) => m.id !== 'symmetry');
    const result = run(missing, photo);
    expect(result.score).toBe(8);
    expect(result.coverage).toBeCloseTo(0.8);
    expect(result.reliability).toBe('limited');
    expect(result.categories.find((c) => c.id === 'symmetry')?.weight).toBe(0.2);
    expect(result.categories.find((c) => c.id === 'symmetry')?.score).toBeNull();
    expect(result.categories.find((c) => c.id === 'eyes')?.score).toBe(8);
  });
  it('does not require unscored descriptive metrics', () => {
    expect(
      run(
        inputs().filter((m) => m.id in targets),
        photo,
      ).score,
    ).toBe(8);
  });
  it.each([null, NaN, Infinity, 0, -1])(
    'excludes invalid ratios and retains a partial estimate (%s)',
    (value) => {
      expect(
        run(
          inputs().map((m) => (m.id === 'face-ratio' ? { ...m, value } : m)),
          photo,
        ).score,
      ).not.toBeNull();
    },
  );
  it('excludes ambiguous duplicate inputs while retaining a partial estimate', () => {
    expect(run([...inputs(), inputs()[0]], photo).score).not.toBeNull();
  });
  it('warns when reliability evidence or sample count is missing', () => {
    expect(
      run(
        inputs().map((m) => ({ ...m, reliabilityReason: undefined })),
        photo,
      ).score,
    ).not.toBeNull();
    expect(
      run(
        inputs().map((m) => ({ ...m, samples: undefined })),
        photo,
      ).score,
    ).not.toBeNull();
  });
  it('warns about invalid or contradictory photo dispersion', () => {
    expect(
      run(
        inputs().map((m) => (m.id === 'face-ratio' ? { ...m, spread: NaN } : m)),
        photo,
      ).score,
    ).not.toBeNull();
    expect(
      run(
        inputs().map((m) => (m.id === 'face-ratio' ? { ...m, rawSpread: 1 } : m)),
        photo,
      ).score,
    ).not.toBeNull();
  });
  it.each([
    { samples: 4 },
    { confidence: 'low' as const },
    { spread: 1 },
    { rawSpread: 1 },
    { retention: 0.7 },
    { retention: undefined },
    { rawSpread: undefined },
    { reliabilityReason: 'outliers' as const },
    { reliabilityReason: 'dispersion' as const },
  ])('retains an indicative score for insufficient or unstable series (%j)', (change) => {
    expect(
      run(
        inputs('live').map((m) => (m.id === 'face-ratio' ? { ...m, ...change } : m)),
        series,
      ).score,
    ).not.toBeNull();
  });
  it.each([
    { valid: false },
    { frontal: false },
    { brightness: NaN },
    { sharpness: 0 },
    { neutralExpression: undefined },
    { stability: 1.1 },
    { faceSize: NaN },
    { label: 'adjust' as const },
  ])('warns about unverified capture evidence (%j)', (change) => {
    expect(
      run(inputs(), { ...photo, quality: { ...readyQuality, ...change } }).score,
    ).not.toBeNull();
  });
  it.each([{ yaw: 8.01 }, { pitch: -8.01 }, { roll: NaN }, { source: 'unavailable' as const }])(
    'warns about an oblique or unknown scoring pose (%j)',
    (change) => {
      expect(run(inputs(), { ...photo, pose: { ...photo.pose, ...change } }).score).not.toBeNull();
    },
  );
  it('returns zero at each tolerance boundary and stays deterministic', () => {
    const tolerance: Record<string, number> = {
      'face-ratio': 0.35,
      'lower-face': 0.25,
      'eye-spacing': 0.8,
      'canthal-tilt': 20,
      symmetry: 0.15,
      'jaw-ratio': 0.35,
      'chin-ratio': 0.18,
    };
    const boundary = inputs().map((m) =>
      m.id in targets ? { ...m, value: targets[m.id] + tolerance[m.id] } : m,
    );
    expect(run(boundary, photo).score).toBeCloseTo(0);
    expect(run(inputs(), photo)).toEqual(run(inputs(), photo));
  });
});
