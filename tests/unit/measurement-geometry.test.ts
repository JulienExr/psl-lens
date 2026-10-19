import { describe, expect, it } from 'vitest';
import { buildMeasurementGeometry } from '../../src/vision/measurement-geometry';
import { definitions } from '../../src/morphometry/metrics';
import { fixtureDetection } from '../fixtures/face';
import type { FaceDetectionResult } from '../../src/types';

const expectedEndpoints: Record<string, [number, number][]> = {
  'face-ratio': [
    [234, 454],
    [10, 152],
  ],
  'lower-face': [
    [2, 152],
    [10, 152],
  ],
  'eye-spacing': [
    [133, 362],
    [33, 133],
    [263, 362],
  ],
  interocular: [
    [468, 473],
    [234, 454],
  ],
  'eye-openness': [
    [159, 145],
    [386, 374],
    [33, 133],
    [263, 362],
  ],
  'brow-spacing': [
    [107, 336],
    [234, 454],
  ],
  'nose-width': [
    [98, 327],
    [234, 454],
  ],
  'nose-ratio': [
    [98, 327],
    [168, 2],
  ],
  'mouth-width': [
    [61, 291],
    [234, 454],
  ],
  'mouth-angle': [[61, 291]],
  'jaw-ratio': [
    [172, 397],
    [234, 454],
  ],
  'chin-ratio': [
    [17, 152],
    [10, 152],
  ],
};
const source = (d: FaceDetectionResult, i: number) => ({
  x: d.faces[0][i].x * d.width,
  y: d.faces[0][i].y * d.height,
});
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 8);
  expect(a.y).toBeCloseTo(b.y, 8);
};
describe('measurement construction in source-image pixels', () => {
  it('constructs all fifteen formula scenes with finite geometry and explanations', () => {
    expect(definitions).toHaveLength(15);
    for (const definition of definitions) {
      const scene = buildMeasurementGeometry(fixtureDetection(), definition.id)!;
      expect(scene, definition.id).not.toBeNull();
      expect(scene.measurementId).toBe(definition.id);
      expect(scene.description.length).toBeGreaterThan(10);
      expect(Number.isFinite(scene.value)).toBe(true);
      expect(scene.keypoints.map((k) => k.landmark)).toEqual(
        expect.arrayContaining(definition.landmarks),
      );
    }
  });
  it.each(Object.entries(expectedEndpoints))(
    '%s shows every numerator and denominator endpoint',
    (id, expected) => {
      const d = fixtureDetection();
      const scene = buildMeasurementGeometry(d, id)!;
      for (const [a, b] of expected) {
        expect(
          scene.segments.some(
            (s) =>
              Math.hypot(s.from.x - source(d, a).x, s.from.y - source(d, a).y) < 1e-8 &&
              Math.hypot(s.to.x - source(d, b).x, s.to.y - source(d, b).y) < 1e-8,
          ),
        ).toBe(true);
      }
    },
  );
  it('projects brow height vertically instead of drawing a diagonal', () => {
    const d = fixtureDetection();
    d.faces[0][105].x = 0.3;
    const scene = buildMeasurementGeometry(d, 'brow-height')!;
    const s = scene.segments.find((s) => s.label === 'Séparation droite')!;
    close(s.from, { x: 192, y: 185.6 });
    close(s.to, { x: 192, y: 230.4 });
    expect(scene.segments.some((s) => s.role === 'projection')).toBe(true);
    expect(scene.value).toBeCloseTo(44.8 / 384);
  });
  it('uses signed canthal arcs on both eyes with mirrored reference rays', () => {
    const d = fixtureDetection();
    d.faces[0][133].y += 0.02;
    d.faces[0][362].y += 0.02;
    const scene = buildMeasurementGeometry(d, 'canthal-tilt')!;
    expect(scene.arcs).toHaveLength(2);
    expect(scene.axes).toHaveLength(2);
    expect(scene.arcs[0].valueDegrees).toBeCloseTo(8.74616226);
    expect(scene.arcs[1].valueDegrees).toBeCloseTo(8.74616226);
    expect(scene.arcs[0].endAngle).toBeGreaterThan(scene.arcs[0].startAngle);
    expect(scene.arcs[1].endAngle).toBeLessThan(scene.arcs[1].startAngle);
    d.faces[0][133].y -= 0.04;
    d.faces[0][362].y -= 0.04;
    expect(buildMeasurementGeometry(d, 'canthal-tilt')!.value).toBeLessThan(0);
  });
  it('reflects pairs across the actual tilted central line', () => {
    const d = fixtureDetection();
    d.faces[0][10] = { x: 0.2, y: 0.2, z: 0 };
    d.faces[0][152] = { x: 0.8, y: 0.8, z: 0 };
    const scene = buildMeasurementGeometry(d, 'symmetry')!;
    close(scene.axes[0].from, { x: 128, y: 128 });
    close(scene.axes[0].to, { x: 512, y: 512 });
    const reflected = scene.keypoints.find((k) => k.role === 'reflected')!.point;
    // Reflection through y=x swaps the source-image coordinates.
    close(reflected, { x: 243.2, y: 448 });
    expect(scene.segments.filter((s) => s.role === 'numerator')).toHaveLength(4);
  });
  it('maps constructed geometry back after image rotation, translation and aspect changes', () => {
    const base = fixtureDetection();
    const rotated = fixtureDetection();
    rotated.width = 1200;
    rotated.height = 800;
    const a = Math.PI / 9;
    const scale = 1.7;
    const transform = (p: { x: number; y: number }) => ({
      x: scale * (p.x * Math.cos(a) - p.y * Math.sin(a)) + 300,
      y: scale * (p.x * Math.sin(a) + p.y * Math.cos(a)) + 50,
    });
    rotated.faces[0] = base.faces[0].map((p) => {
      const q = transform({ x: p.x * 640, y: p.y * 640 });
      return { x: q.x / 1200, y: q.y / 800, z: p.z };
    });
    for (const { id } of definitions) {
      const original = buildMeasurementGeometry(base, id)!;
      const moved = buildMeasurementGeometry(rotated, id)!;
      expect(moved.value).toBeCloseTo(original.value, 8);
      moved.segments.forEach((s, i) => {
        close(s.from, transform(original.segments[i].from));
        close(s.to, transform(original.segments[i].to));
      });
      moved.arcs.forEach((arc, i) => {
        close(arc.center, transform(original.arcs[i].center));
        expect(arc.radius).toBeCloseTo(original.arcs[i].radius * scale, 8);
        expect(arc.startAngle).toBeCloseTo(original.arcs[i].startAngle + a);
      });
    }
  });
  it('rejects absent, nonfinite, multiple and degenerate faces and unknown measures', () => {
    expect(buildMeasurementGeometry(fixtureDetection(), 'unknown')).toBeNull();
    for (const mutate of [
      (d: FaceDetectionResult) => {
        d.width = 0;
      },
      (d: FaceDetectionResult) => {
        delete d.faces[0][105];
      },
      (d: FaceDetectionResult) => {
        d.faces = [];
      },
      (d: FaceDetectionResult) => {
        d.faces[0].length = 477;
      },
      (d: FaceDetectionResult) => {
        d.faces.push(d.faces[0]);
      },
      (d: FaceDetectionResult) => {
        d.faces[0][105].x = NaN;
      },
      (d: FaceDetectionResult) => {
        d.faces[0][454] = d.faces[0][234];
      },
    ]) {
      const d = fixtureDetection();
      mutate(d);
      expect(buildMeasurementGeometry(d, 'face-ratio')).toBeNull();
    }
    const d = fixtureDetection();
    d.faces[0][105].y = 0.5;
    expect(buildMeasurementGeometry(d, 'brow-height')).toBeNull();
  });
});
