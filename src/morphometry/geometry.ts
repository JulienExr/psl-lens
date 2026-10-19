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
