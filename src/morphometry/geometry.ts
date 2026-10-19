export interface Point {
  x: number;
  y: number;
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const angle = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
export const ratio = (a: number, b: number): number | null =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-8 ? a / b : null;
export function deroll(points: Point[], degrees: number): Point[] {
  const r = (-degrees * Math.PI) / 180;
  return points.map((p) => ({
    x: p.x * Math.cos(r) - p.y * Math.sin(r),
    y: p.x * Math.sin(r) + p.y * Math.cos(r),
  }));
}
export function reflectAcrossLine(point: Point, a: Point, b: Point): Point | null {
  if (![point.x, point.y, a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 <= 1e-16) return null;
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2;
  return { x: 2 * (a.x + t * dx) - point.x, y: 2 * (a.y + t * dy) - point.y };
}

// Essential surface baselines, in the same coordinate system as the supplied points.
export function hasFaceBaselines(points: Point[]): boolean {
  if (points.length < 478) return false;
  const pairs = [
    [234, 454],
    [10, 152],
    [33, 263],
    [33, 133],
    [263, 362],
  ];
  const lengths = pairs.map(([a, b]) => distance(points[a], points[b]));
  const reference = Math.max(lengths[0], lengths[1]);
  if (!lengths.every((v) => Number.isFinite(v) && v > Math.max(1e-8, reference * 1e-4)))
    return false;
  const a = points[33],
    b = points[263];
  const projection = (p: Point) =>
    ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengths[2] ** 2;
  const innerRight = projection(points[133]),
    innerLeft = projection(points[362]);
  return innerRight > 1e-4 && innerLeft > innerRight + 1e-4 && innerLeft < 1 - 1e-4;
}
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n ? (s[Math.floor((n - 1) / 2)] + s[Math.floor(n / 2)]) / 2 : NaN;
}
export function robustSummary(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  const center = median(finite);
  const mad = median(finite.map((v) => Math.abs(v - center)));
  // 3 robust sigma; a 2% relative floor prevents a zero-MAD cluster keeping an outlier.
  const threshold = Math.max(3 * 1.4826 * mad, Math.abs(center) * 0.02, 1e-5);
  const kept = finite.filter((v) => Math.abs(v - center) <= threshold);
  return {
    value: median(kept),
    spread: 1.4826 * median(kept.map((v) => Math.abs(v - median(kept)))),
    samples: kept.length,
    rejected: finite.length - kept.length,
  };
}
