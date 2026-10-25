import { describe, expect, it } from 'vitest';
import { analyzeProfile } from '../../src/morphometry/profile';
import type { ProfilePoint, ProfilePointId } from '../../src/types/v2';
const raw = {
  nasion: [0.45, 0.2],
  pronasale: [0.68, 0.38],
  subnasale: [0.5, 0.45],
  upperLip: [0.55, 0.5],
  lowerLip: [0.55, 0.56],
  pogonion: [0.54, 0.65],
  menton: [0.45, 0.72],
  cervical: [0.28, 0.75],
};
export const points = Object.fromEntries(
  Object.entries(raw).map(([k, [x, y]]) => [k, { x, y, source: 'manual', confirmed: true }]),
) as Record<ProfilePointId, ProfilePoint>;
const analyze = (
  p: Partial<Record<ProfilePointId, ProfilePoint>> = points,
  width = 1000,
  height = 1000,
) =>
  analyzeProfile({
    points: p,
    width,
    height,
    side: 'left',
    strictProfileConfirmed: true,
    source: 'import',
  });
describe('assisted profile geometry', () => {
  it('measures visible projections and seven explicit lateral constructions', () => {
    const a = analyze();
    expect(a.quality.valid).toBe(true);
    expect(a.measurements).toHaveLength(7);
    expect(a.facing).toBe('image-right');
    expect(a.measurements.find((m) => m.id === 'nose-projection')?.value).toBeCloseTo(0.18 / 0.52);
    expect(a.measurements.every((m) => m.quality === 'limited' && m.samples === 1)).toBe(true);
  });
  it('preserves all measures under translation, uniform scaling, rotation, resolution and mirroring', () => {
    const base = analyze().measurements;
    for (const angle of [0, 0.25, -0.3]) {
      const transformed = Object.fromEntries(
        Object.entries(points).map(([k, p]) => {
          const x = (p.x - 0.5) * 0.7,
            y = (p.y - 0.5) * 0.7;
          return [
            k,
            {
              ...p,
              x: 0.5 + x * Math.cos(angle) - y * Math.sin(angle),
              y: 0.5 + x * Math.sin(angle) + y * Math.cos(angle),
            },
          ];
        }),
      );
      for (const candidate of [
        analyze(transformed),
        analyze(transformed, 2000, 2000),
        analyze(
          Object.fromEntries(
            Object.entries(transformed).map(([k, p]) => [k, { ...p, x: 1 - p.x }]),
          ),
        ),
      ])
        candidate.measurements.forEach((m, i) => expect(m.value).toBeCloseTo(base[i].value!, 9));
    }
  });
  it('uses pixel aspect ratio rather than stretching normalized coordinates', () => {
    const p = Object.fromEntries(Object.entries(points).map(([k, p]) => [k, { ...p, x: p.x / 2 }]));
    analyze(p, 2000, 1000).measurements.forEach((m, i) =>
      expect(m.value).toBeCloseTo(analyze().measurements[i].value!, 9),
    );
  });
  it('does not invent optional lip or neck measures', () => {
    const p = { ...points };
    delete (p as Partial<typeof p>).upperLip;
    delete (p as Partial<typeof p>).cervical;
    const a = analyze(p);
    expect(a.quality.valid).toBe(true);
    expect(a.measurements.filter((m) => m.value === null).map((m) => m.id)).toEqual([
      'upper-lip-offset',
      'chin-neck-angle',
    ]);
  });
  it.each([NaN, Infinity, -1, 2])('rejects invalid point %s', (x) => {
    expect(analyze({ ...points, nasion: { ...points.nasion, x } }).quality.valid).toBe(false);
  });
  it('requires explicit orientation confirmation and confirmed ordered noncollapsed reference points', () => {
    expect(
      analyzeProfile({
        points,
        width: 1000,
        height: 1000,
        side: 'unknown',
        strictProfileConfirmed: false,
        source: 'import',
      }).quality.valid,
    ).toBe(false);
    expect(
      analyze({ ...points, menton: points.nasion }).measurements.every((m) => m.value === null),
    ).toBe(true);
    expect(
      analyze({ ...points, subnasale: { ...points.subnasale, confirmed: false } }).quality.valid,
    ).toBe(false);
    expect(analyze({ ...points, subnasale: { ...points.subnasale, y: 0.1 } }).quality.valid).toBe(
      false,
    );
    expect(analyze(points, 0, 1000).quality.valid).toBe(false);
  });
});
