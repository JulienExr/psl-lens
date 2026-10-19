import { describe, expect, it } from 'vitest';
import {
  angle,
  distance,
  median,
  ratio,
  robustSummary,
  deroll,
} from '../../src/morphometry/geometry';
import { measure } from '../../src/morphometry/metrics';
import { score } from '../../src/scoring';
import { fixtureDetection, readyQuality } from '../fixtures/face';

describe('geometry in image pixels', () => {
  it('computes Euclidean distance and rejects zero denominator', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(NaN, 2)).toBeNull();
  });
  it('computes an angle with explicit degrees', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
  });
  it('corrects roll without changing lengths', () => {
    const p = deroll(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      45,
    );
    expect(p[1].y).toBeCloseTo(0);
    expect(distance(p[0], p[1])).toBeCloseTo(Math.sqrt(2));
  });
  it('aggregates medians and rejects an outlier even when MAD is zero', () => {
    expect(median([3, 1, 2, 4])).toBe(2.5);
    expect(robustSummary([1, 1, 1, 1, 100])).toMatchObject({ value: 1, samples: 4, rejected: 1 });
    expect(robustSummary([NaN, Infinity])).toBeNull();
  });
});
describe('morphometry', () => {
  it('returns fifteen real descriptive measures and finite ratios', () => {
    const metrics = measure(fixtureDetection(), readyQuality);
    expect(metrics).toHaveLength(15);
    expect(metrics.every((m) => m.value !== null && Number.isFinite(m.value))).toBe(true);
    expect(metrics.find((m) => m.id === 'symmetry')?.value).toBeCloseTo(0);
  });
  it('accounts for image aspect ratio', () => {
    const a = fixtureDetection();
    const b = { ...a, width: a.width * 2 };
    expect(measure(b, readyQuality)[0].value).toBeCloseTo(measure(a, readyQuality)[0].value! * 2);
  });
  it('does not invent missing points or oblique measurements', () => {
    expect(
      measure({ ...fixtureDetection(), faces: [[]] }, readyQuality).every((m) => m.value === null),
    ).toBe(true);
    expect(
      measure(fixtureDetection(), { ...readyQuality, frontal: false }).every(
        (m) => m.value === null,
      ),
    ).toBe(true);
  });
  it('rejects multiple faces and non-finite landmarks', () => {
    const detection = fixtureDetection();
    detection.faces.push(detection.faces[0]);
    expect(measure(detection, readyQuality).every((m) => m.value === null)).toBe(true);
    const invalid = fixtureDetection();
    invalid.faces[0][33].x = NaN;
    expect(measure(invalid, readyQuality).every((m) => m.value === null)).toBe(true);
  });
});
describe('experimental scoring', () => {
  it('is deterministic and refuses a global score without profile evidence', () => {
    const metrics = measure(fixtureDetection(), readyQuality);
    expect(score(metrics)).toEqual(score(metrics));
    expect(score(metrics).score).toBeNull();
    expect(score(metrics).categories.filter((c) => c.score !== null)).toHaveLength(4);
    expect(score(metrics).missing).toContain('Équilibre du profil');
  });
  it('does not replace missing measurements or accept invalid configuration', () => {
    expect(score([]).categories.every((c) => c.score === null)).toBe(true);
    expect(() => score([], { ...scoreConfig(), weights: [1, 1] })).toThrow();
  });
});
function scoreConfig() {
  return { version: 'test', weights: [0.25, 0.2, 0.2, 0.2, 0.15] };
}
