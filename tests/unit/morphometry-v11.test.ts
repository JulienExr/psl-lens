import { describe, expect, it } from 'vitest';
import { measure } from '../../src/morphometry/metrics';
import * as geometry from '../../src/morphometry/geometry';
import { assessQuality, poseFromMatrix } from '../../src/vision/quality';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import type { FaceDetectionResult } from '../../src/types';
import canonical from '../../src/vision/canonical.json';

const pixels = { brightness: 130, sharpness: 80 };
const value = (d: FaceDetectionResult, id: string) =>
  measure(d, readyQuality).find((m) => m.id === id)!.value;

describe('corrected frontal geometry', () => {
  it('refuses a collapsed mouth instead of inventing a zero angle or width', () => {
    const d = fixtureDetection();
    d.faces[0][291] = { ...d.faces[0][61] };
    expect(value(d, 'mouth-angle')).toBeNull();
    expect(value(d, 'mouth-width')).toBeNull();
  });
  it('measures brow height vertically, independent of horizontal brow offset', () => {
    const d = fixtureDetection();
    const original = value(d, 'brow-height');
    d.faces[0][105].x += 0.1;
    d.faces[0][334].x -= 0.1;
    expect(value(d, 'brow-height')).toBeCloseTo(original!);
    d.faces[0][105].y += 0.02;
    d.faces[0][334].y += 0.02;
    expect(value(d, 'brow-height')).toBeCloseTo(0.05 / 0.6);
  });

  it('rejects inverted or collapsed brow-to-lid ordering', () => {
    const d = fixtureDetection();
    d.faces[0][105].y = d.faces[0][159].y;
    expect(value(d, 'brow-height')).toBeNull();
    d.faces[0][105].y += 0.1;
    expect(value(d, 'brow-height')).toBeNull();
  });

  it('exports a reflection construction for an arbitrary line and rejects a collapsed axis', () => {
    expect(geometry).toHaveProperty('reflectAcrossLine');
    if (!('reflectAcrossLine' in geometry)) return;
    const reflect = geometry.reflectAcrossLine as (
      p: geometry.Point,
      a: geometry.Point,
      b: geometry.Point,
    ) => geometry.Point | null;
    expect(reflect({ x: 3, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 3 });
    expect(reflect({ x: 3, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('reflects symmetry pairs about the actual forehead–chin line', () => {
    const d = fixtureDetection();
    d.faces[0][10].x = 0.4;
    d.faces[0][152].x = 0.6;
    const a = d.faces[0][10],
      b = d.faces[0][152];
    const ux = b.x - a.x,
      uy = b.y - a.y,
      length2 = ux * ux + uy * uy;
    const expected =
      [
        [33, 263],
        [133, 362],
        [61, 291],
        [172, 397],
      ].reduce((sum, [i, j]) => {
        const p = d.faces[0][j],
          q = d.faces[0][i];
        const t = ((p.x - a.x) * ux + (p.y - a.y) * uy) / length2;
        return sum + Math.hypot(q.x - (2 * (a.x + t * ux) - p.x), q.y - (2 * (a.y + t * uy) - p.y));
      }, 0) /
      4 /
      0.6;
    expect(value(d, 'symmetry')).toBeCloseTo(expected);
  });

  it.each(['scale', 'translation', 'roll', 'canvas aspect'] as const)(
    'preserves every measure under %s',
    (transform) => {
      const original = fixtureDetection();
      const d = structuredClone(original);
      if (transform === 'scale') {
        d.width *= 2;
        d.height *= 2;
      }
      if (transform === 'translation')
        d.faces[0] = d.faces[0].map((p) => ({ ...p, x: p.x + 0.07, y: p.y - 0.04 }));
      if (transform === 'roll') {
        const r = (15 * Math.PI) / 180;
        d.faces[0] = d.faces[0].map((p) => ({
          ...p,
          x: 0.5 + Math.cos(r) * (p.x - 0.5) - Math.sin(r) * (p.y - 0.5),
          y: 0.5 + Math.sin(r) * (p.x - 0.5) + Math.cos(r) * (p.y - 0.5),
        }));
      }
      if (transform === 'canvas aspect') {
        d.width *= 2;
        d.height *= 1.5;
        d.faces[0] = d.faces[0].map((p) => ({ ...p, x: p.x / 2, y: p.y / 1.5 }));
      }
      const expected = measure(original, readyQuality);
      measure(d, readyQuality).forEach((m, i) =>
        expect(m.value).toBeCloseTo(expected[i].value!, 10),
      );
    },
  );

  it('uses positive tilt for higher outer canthi and positive mouth angle down to image right', () => {
    const d = fixtureDetection();
    d.faces[0][133].y += 0.02;
    d.faces[0][362].y += 0.02;
    d.faces[0][291].y += 0.02;
    expect(value(d, 'canthal-tilt')).toBeGreaterThan(0);
    expect(value(d, 'mouth-angle')).toBeGreaterThan(0);
    d.faces[0][133].y -= 0.04;
    d.faces[0][362].y -= 0.04;
    expect(value(d, 'canthal-tilt')).toBeLessThan(0);
  });

  it.each([
    ['outer eye', 263, 33],
    ['face width', 454, 234],
    ['face height', 152, 10],
  ] as const)('refuses a collapsed %s baseline', (_, target, source) => {
    const d = fixtureDetection();
    d.faces[0][target] = { ...d.faces[0][source] };
    expect(measure(d, readyQuality).every((m) => m.value === null)).toBe(true);
  });

  it('refuses non-finite depth and actual out-of-plane pose despite stale quality', () => {
    const d = fixtureDetection();
    d.faces[0][33].z = NaN;
    expect(measure(d, readyQuality).every((m) => m.value === null)).toBe(true);
    expect(measure(fixtureDetection(20), readyQuality).every((m) => m.value === null)).toBe(true);
  });
  it('rejects crossed inner canthi instead of treating them as ordinary eye widths', () => {
    const d = fixtureDetection();
    d.faces[0][133].x = 0.6;
    d.faces[0][362].x = 0.4;
    expect(measure(d, readyQuality).every((m) => m.value === null)).toBe(true);
  });

  it('shows perspective sensitivity instead of pretending yaw/pitch invariance', () => {
    const projected = (yaw: number, pitch: number) => {
      const d = fixtureDetection(yaw),
        a = (yaw * Math.PI) / 180,
        b = (pitch * Math.PI) / 180;
      d.pose.pitch = pitch;
      d.faces[0] = canonical
        .map((p) => {
          const x = (p.x - 0.5) * 16,
            y = -(p.y - 0.5) * 18,
            z = p.z * 16;
          const xx = x * Math.cos(a) + z * Math.sin(a),
            zz = -x * Math.sin(a) + z * Math.cos(a);
          return { x: 0.5 + xx / 28, y: 0.5 - (y * Math.cos(b) - zz * Math.sin(b)) / 28, z: 0 };
        })
        .concat(d.faces[0].slice(468));
      return d;
    };
    expect(value(projected(0, 0), 'symmetry')).toBeCloseTo(0);
    expect(value(projected(10, 0), 'symmetry')).toBeGreaterThan(0.03);
    expect(
      value(projected(0, 10), 'canthal-tilt')! - value(projected(0, 0), 'canthal-tilt')!,
    ).toBeGreaterThan(2);
  });
});

describe('finite capture evidence', () => {
  it.each(['yaw', 'pitch', 'roll'] as const)('refuses non-finite %s', (axis) => {
    const d = fixtureDetection();
    d.pose[axis] = NaN;
    expect(assessQuality(d, pixels).valid).toBe(false);
  });
  it.each(['width', 'height', 'timestamp'] as const)('refuses non-finite %s', (field) => {
    const d = fixtureDetection();
    d[field] = Infinity;
    expect(assessQuality(d, pixels).valid).toBe(false);
  });
  it.each(['brightness', 'sharpness'] as const)('refuses non-finite %s', (field) => {
    expect(assessQuality(fixtureDetection(), { ...pixels, [field]: NaN }).valid).toBe(false);
  });
  it('requires explicit expression evidence to certify neutrality', () => {
    expect(assessQuality({ ...fixtureDetection(), blendshapes: {} }, pixels).valid).toBe(false);
    expect(assessQuality(fixtureDetection(), pixels)).toMatchObject({
      valid: true,
      neutralExpression: true,
    });
  });
  it('rejects a shear matrix that cannot represent rigid face pose', () => {
    expect(poseFromMatrix([1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).source).toBe(
      'unavailable',
    );
  });
  it('refuses invalid preceding observations when checking temporal stability', () => {
    const previous = fixtureDetection(0, 0);
    previous.faces[0][1].x = NaN;
    expect(assessQuality(fixtureDetection(0, 200), pixels, previous).valid).toBe(false);
  });
});
