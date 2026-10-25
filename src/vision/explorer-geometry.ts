import type { FaceDetectionResult } from '../types';

export interface ExplorerPoint {
  x: number;
  y: number;
  z: number;
}
/** Camera angles are degrees; zoom is a uniform display scale. */
export interface ExplorerCamera {
  yaw: number;
  pitch: number;
  zoom: number;
}

/** Relative weak-perspective geometry, never metric or anatomically canonicalized.
 * Keep source indices (including invalid slots) so topology cannot join wrong points.
 */
export function normalizeFaceGeometry(
  result: FaceDetectionResult | null,
): (ExplorerPoint | null)[] | null {
  if (
    !result ||
    result.faces.length !== 1 ||
    !Array.isArray(result.faces[0]) ||
    ![result.width, result.height].every((n) => Number.isFinite(n) && n > 0)
  )
    return null;
  const points = Array.from(result.faces[0], (p) => {
    if (!p || ![p.x, p.y, p.z].every(Number.isFinite)) return null;
    const point = { x: p.x * result.width, y: p.y * result.height, z: p.z * result.width };
    return Object.values(point).every(Number.isFinite) ? point : null;
  });
  const valid = points.filter((p): p is ExplorerPoint => p !== null);
  if (valid.length < 2) return null;
  const center = { x: 0, y: 0, z: 0 };
  for (const axis of ['x', 'y', 'z'] as const) {
    let min = Infinity,
      max = -Infinity;
    for (const p of valid) {
      min = Math.min(min, p[axis]);
      max = Math.max(max, p[axis]);
    }
    center[axis] = min / 2 + max / 2;
  }
  let radius = 0;
  for (const p of valid)
    radius = Math.max(radius, Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z));
  if (!Number.isFinite(radius) || radius <= 1e-9) return null;
  return points.map((p) =>
    p
      ? { x: (p.x - center.x) / radius, y: (p.y - center.y) / radius, z: (p.z - center.z) / radius }
      : null,
  );
}

/** Orthographic display: no additional perspective or independent axis scaling.
 * Flat mode drops depth and ignores camera rotation, preserving the image plane.
 */
export function projectGeometry(
  points: (ExplorerPoint | null)[],
  width: number,
  height: number,
  camera: ExplorerCamera,
  flat = false,
): (ExplorerPoint | null)[] {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) return [];
  const yaw = !flat && Number.isFinite(camera.yaw) ? ((camera.yaw % 360) * Math.PI) / 180 : 0;
  const pitch = !flat && Number.isFinite(camera.pitch) ? ((camera.pitch % 360) * Math.PI) / 180 : 0;
  const zoom = Number.isFinite(camera.zoom) ? Math.min(2, Math.max(0.5, camera.zoom)) : 1;
  const scale = Math.min(width, height) * 0.42 * zoom;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return points.map((p) => {
    if (!p || !Object.values(p).every(Number.isFinite)) return null;
    const x = p.x * cy + p.z * sy;
    const z = -p.x * sy + p.z * cy;
    const y = p.y * cp - z * sp;
    const projected = {
      x: width / 2 + x * scale,
      y: height / 2 + y * scale,
      z: flat ? 0 : p.y * sp + z * cp,
    };
    return Object.values(projected).every(Number.isFinite) ? projected : null;
  });
}
