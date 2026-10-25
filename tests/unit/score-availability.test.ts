import { expect, it } from 'vitest';
import { measure } from '../../src/morphometry/metrics';
import { scoreFrontal } from '../../src/scoring/frontal';
import { aggregate } from '../../src/vision/temporal';
import { fixtureDetection, readyQuality } from '../fixtures/face';

const poorQuality = {
  ...readyQuality,
  valid: false,
  frontal: false,
  sharpness: 2,
  brightness: 25,
  issues: ['Image trop floue : stabilisez la caméra.'],
  label: 'adjust' as const,
};
const observation = () => {
  const detection = fixtureDetection(22);
  return {
    detection,
    quality: poorQuality,
    measurements: measure(detection, poorQuality, { allowApproximate: true }),
    stage: 'front' as const,
  };
};

it('keeps real apparent measurements with low reliability when quality is poor', () => {
  const o = observation();
  expect(o.measurements.filter((m) => m.value !== null).length).toBeGreaterThan(10);
  expect(o.measurements.every((m) => m.confidence === 'low')).toBe(true);
  expect(measure(o.detection, poorQuality).every((m) => m.value === null)).toBe(true);
});

it.each(['no-face', 'two-faces', 'invalid', 'collapsed'])(
  'never estimates from unmeasurable geometry: %s',
  (kind) => {
    const detection = fixtureDetection();
    if (kind === 'no-face') detection.faces = [];
    if (kind === 'two-faces') detection.faces.push(detection.faces[0]);
    if (kind === 'invalid') detection.faces[0][33].x = NaN;
    if (kind === 'collapsed')
      detection.faces[0] = detection.faces[0].map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    expect(
      measure(detection, poorQuality, { allowApproximate: true }).every((m) => m.value === null),
    ).toBe(true);
  },
);

it('keeps a numeric score and actionable warnings for blur, darkness and an oblique pose', () => {
  const o = observation();
  const result = scoreFrontal(o.measurements, {
    source: 'photo',
    quality: o.quality,
    pose: o.detection.pose,
  });
  expect(result.score).not.toBeNull();
  expect(Number.isFinite(result.score)).toBe(true);
  expect(result.reliability).toBe('limited');
  expect(result.reasons.join(' ')).toMatch(/floue/);
  expect(result.reasons.join(' ')).toMatch(/pose|rotation/i);
  expect(result.version).toBe('psl-frontal-1.1.0');
});

it('normalizes only measured input weights and exposes partial coverage', () => {
  const measurements = measure(fixtureDetection(), readyQuality).filter((m) => m.id !== 'symmetry');
  const result = scoreFrontal(measurements, {
    source: 'photo',
    quality: readyQuality,
    pose: fixtureDetection().pose,
  });
  expect(result.score).not.toBeNull();
  expect(result.coverage).toBeCloseTo(0.8);
  expect(result.reliability).toBe('limited');
  expect(result.categories.find((c) => c.id === 'symmetry')?.score).toBeNull();
  expect(result.categories.reduce((sum, c) => sum + (c.contribution ?? 0), 0)).toBeCloseTo(
    result.score!,
  );
  expect(result.reasons.join(' ')).toMatch(/partielle|disponibles/);
});

it('does not manufacture a score if every scoring input is absent', () => {
  const result = scoreFrontal([], {
    source: 'photo',
    quality: readyQuality,
    pose: fixtureDetection().pose,
  });
  expect(result.score).toBeNull();
  expect(result.coverage).toBe(0);
});

it('preserves each original input weight when only half a category is measurable', () => {
  const values: Record<string, number | null> = {
    'face-ratio': null,
    'lower-face': 0.4,
    'eye-spacing': 1.8,
    'canthal-tilt': 4,
    symmetry: 0.15,
    'jaw-ratio': 0.78,
    'chin-ratio': 0.2,
  };
  const measurements = measure(fixtureDetection(), readyQuality).map((m) =>
    m.id in values ? { ...m, value: values[m.id] } : m,
  );
  const result = scoreFrontal(measurements, {
    source: 'photo',
    quality: readyQuality,
    pose: fixtureDetection().pose,
  });
  // Remaining proportions contribute .15×8, eyes .25×4, symmetry .20×0,
  // jaw .25×8; the actually measured nominal weight is .85.
  expect(result.coverage).toBeCloseTo(0.85);
  expect(result.score).toBeCloseTo(4.2 / 0.85);
  expect(result.categories.find((c) => c.id === 'proportions')?.coverage).toBe(0.5);
  expect(result.categories.reduce((sum, c) => sum + (c.contribution ?? 0), 0)).toBeCloseTo(
    result.score!,
  );
});

it('allows a poor photo to reach a report with a numeric limited score', () => {
  const report = aggregate([observation()], 'photo');
  expect(report.frontalScore.score).not.toBeNull();
  expect(report.frontalScore.reliability).toBe('limited');
  expect(report.quality.valid).toBe(false);
  expect(report.measurements.every((m) => m.confidence !== 'moderate')).toBe(true);
});

it('keeps a short Live series available and never promotes poor capture to moderate', () => {
  const report = aggregate([observation()], 'live');
  expect(report.frontalScore.score).not.toBeNull();
  expect(report.frontalScore.reliability).toBe('limited');
  expect(
    aggregate(Array.from({ length: 8 }, observation), 'live').measurements.every(
      (m) => m.confidence !== 'moderate',
    ),
  ).toBe(true);
});

it('warns about incomplete multi-angle continuity while retaining the frontal estimate', () => {
  const detection = fixtureDetection();
  const report = aggregate(
    Array.from({ length: 16 }, () => ({
      detection,
      quality: readyQuality,
      measurements: measure(detection, readyQuality),
      stage: 'front' as const,
    })),
    'guided',
    0,
    { scanMode: 'multi-angle' },
  );
  expect(report.frontalScore.score).not.toBeNull();
  expect(report.frontalScore.reliability).toBe('limited');
  expect(report.frontalScore.reasons.join(' ')).toMatch(/multi-angle/i);
});
