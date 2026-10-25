import { describe, expect, it } from 'vitest';
import { normalizeFaceGeometry, projectGeometry } from '../../src/vision/explorer-geometry';
import { fixtureDetection } from '../fixtures/face';

describe('estimated geometry normalization', () => {
  it('preserves source-pixel proportions and width-relative depth with one scale', () => {
    const result = fixtureDetection();
    result.width = 1000;
    result.height = 500;
    result.faces = [
      [
        { x: 0.2, y: 0.2, z: -0.1 },
        { x: 0.6, y: 0.6, z: 0.1 },
      ],
    ];
    const points = normalizeFaceGeometry(result)!;
    const a = points[0]!,
      b = points[1]!;
    expect(b.x - a.x).toBeCloseTo(2 * (b.y - a.y));
    expect(b.z - a.z).toBeCloseTo(b.y - a.y);
    expect(a.x + b.x).toBeCloseTo(0);
    expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(1);
  });

  it('keeps source indices when points are missing and excludes nonfinite coordinates', () => {
    const result = fixtureDetection();
    result.faces = [
      [
        { x: 0, y: 0, z: 0 },
        { x: NaN, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    ];
    delete result.faces[0][0];
    result.faces[0].push({ x: 0, y: 0, z: 0 });
    const points = normalizeFaceGeometry(result)!;
    expect(points).toHaveLength(4);
    expect(points[0]).toBeNull();
    expect(points[1]).toBeNull();
    expect(points[2]).not.toBeNull();
    expect(result.faces[0][2]).toEqual({ x: 1, y: 1, z: 0 });
  });

  it('rejects absent, ambiguous, degenerate and invalid image geometry', () => {
    expect(normalizeFaceGeometry(null)).toBeNull();
    const result = fixtureDetection();
    result.faces = [];
    expect(normalizeFaceGeometry(result)).toBeNull();
    result.faces = [[], []];
    expect(normalizeFaceGeometry(result)).toBeNull();
    result.faces = [[]];
    delete result.faces[0];
    expect(normalizeFaceGeometry(result)).toBeNull();
    result.faces = [
      [
        { x: 1, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    ];
    expect(normalizeFaceGeometry(result)).toBeNull();
    result.width = Infinity;
    expect(normalizeFaceGeometry(result)).toBeNull();
  });
});

describe('orthographic explorer camera', () => {
  const points = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, null];
  it('rotates relative depth into the view and preserves missing index slots', () => {
    const projected = projectGeometry(points, 400, 200, { yaw: 90, pitch: 0, zoom: 1 });
    expect(projected[0]!.x).toBeCloseTo(200);
    expect(projected[0]!.y).toBeCloseTo(100);
    expect(projected[1]!.x).toBeCloseTo(284);
    expect(projected[2]).toBeNull();
  });

  it('fits with the same scale on both screen axes, independently of viewport aspect', () => {
    const projected = projectGeometry([{ x: 1, y: 1, z: 0 }], 400, 200, {
      yaw: 0,
      pitch: 0,
      zoom: 1,
    });
    expect(projected[0]).toMatchObject({ x: 284, y: 184 });
  });

  it('provides a flat source orientation independent of camera rotation', () => {
    const projected = projectGeometry(points, 400, 200, { yaw: 90, pitch: 60, zoom: 1 }, true);
    expect(projected[0]).toMatchObject({ x: 284, y: 100 });
    expect(projected[1]).toMatchObject({ x: 200, y: 100 });
  });

  it('guards invalid viewports and camera input without emitting nonfinite paths', () => {
    expect(projectGeometry(points, 0, 200, { yaw: 0, pitch: 0, zoom: 1 })).toEqual([]);
    const projected = projectGeometry(points, 400, 200, { yaw: NaN, pitch: Infinity, zoom: NaN });
    expect(projected[0]).toMatchObject({ x: 284, y: 100 });
  });

  it('does not emit nonfinite paths for extreme finite camera or projection values', () => {
    const projected = projectGeometry(points, 400, 200, { yaw: 1e308, pitch: 1e308, zoom: 2 });
    expect(projected.filter(Boolean).every((p) => Object.values(p!).every(Number.isFinite))).toBe(
      true,
    );
    expect(
      projectGeometry([{ x: 1e308, y: 0, z: 0 }], 1e308, 1e308, { yaw: 0, pitch: 0, zoom: 2 })[0],
    ).toBeNull();
  });
});
