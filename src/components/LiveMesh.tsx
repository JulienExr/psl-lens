import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { FaceDetectionResult, Region } from '../types';
import type { Point } from '../morphometry/geometry';
import { definitions } from '../morphometry/metrics';
import { measurementScenes, pointIndices, regionConnections } from '../vision/measurement-geometry';
import type { Layer } from './Mesh';

export interface LiveMeshHandle {
  draw(result: FaceDetectionResult | null): number;
}
export interface LiveMeshProps {
  layer?: Layer;
  region?: Region;
  measurementId?: string;
}

/** Imperative drawing keeps the camera's inference cadence out of React's SVG tree.
 * The parent uses the same aspect-ratio and mirror wrapper as the video.
 */
export const LiveMesh = forwardRef<LiveMeshHandle, LiveMeshProps>(function LiveMesh(
  { layer = 'mesh', region = 'all', measurementId },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<FaceDetectionResult | null>(null);
  const draw = useCallback(
    (result: FaceDetectionResult | null): number => {
      const start = performance.now();
      const hadResult = last.current !== null;
      last.current = result;
      const element = canvas.current;
      if (!element) return performance.now() - start;
      if (!result && !hadResult) return performance.now() - start;
      const valid =
        result &&
        result.faces.length === 1 &&
        result.faces[0].length >= 478 &&
        Number.isFinite(result.width) &&
        result.width > 0 &&
        Number.isFinite(result.height) &&
        result.height > 0 &&
        Array.from(result.faces[0]).every((p) => p && [p.x, p.y, p.z].every(Number.isFinite));
      if (valid) {
        // Backing pixels are source pixels; CSS scales video and overlay together.
        if (element.width !== result.width) element.width = result.width;
        if (element.height !== result.height) element.height = result.height;
      }
      const context = element.getContext('2d');
      if (!context) return performance.now() - start;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, element.width, element.height);
      if (!valid || layer === 'video') return performance.now() - start;
      const color = getComputedStyle(element).color || '#62e5c0';
      context.strokeStyle = color;
      context.fillStyle = color;
      context.globalAlpha = layer === 'mesh' ? 0.55 : 1;
      // Approximate non-scaling SVG stroke widths under the CSS display size.
      const displayed = element.getBoundingClientRect().width;
      const scale = displayed > 0 ? result.width / displayed : 1;
      const line = (from: Point, to: Point, width: number, dash: number[] = []) => {
        context.lineWidth = width * scale;
        context.setLineDash(dash.map((d) => d * scale));
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      };
      const dot = (point: Point, hollow = false) => {
        context.setLineDash([]);
        context.lineWidth = scale;
        context.beginPath();
        context.arc(point.x, point.y, result.width * 0.0035, 0, Math.PI * 2);
        if (hollow) context.stroke();
        else context.fill();
      };
      const points = result.faces[0];
      const pixel = (i: number): Point => ({
        x: points[i].x * result.width,
        y: points[i].y * result.height,
      });
      if (layer === 'mesh') {
        // One canvas; no React element is allocated for any connection.
        context.lineWidth = 0.65 * scale;
        context.setLineDash([]);
        context.beginPath();
        for (const e of regionConnections[region]) {
          const a = pixel(e.start),
            b = pixel(e.end);
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
        }
        context.stroke();
      } else if (layer === 'points') {
        for (const i of pointIndices(region)) dot(pixel(i));
      } else {
        for (const scene of measurementScenes(result, region, measurementId)) {
          for (const s of scene.segments)
            line(
              s.from,
              s.to,
              s.role === 'numerator' ? 2 : 1.4,
              s.role === 'denominator'
                ? [6, 3]
                : s.role === 'comparison' || s.role === 'projection'
                  ? [2, 3]
                  : [],
            );
          for (const a of scene.axes) line(a.from, a.to, 1, [8, 4]);
          for (const a of scene.arcs) {
            context.lineWidth = 2 * scale;
            context.setLineDash([]);
            context.beginPath();
            context.arc(
              a.center.x,
              a.center.y,
              a.radius,
              a.startAngle,
              a.endAngle,
              a.endAngle < a.startAngle,
            );
            context.stroke();
          }
          for (const k of scene.keypoints) dot(k.point, k.role !== 'landmark');
        }
      }
      return performance.now() - start;
    },
    [layer, region, measurementId],
  );
  useImperativeHandle(ref, () => ({ draw }), [draw]);
  useEffect(() => {
    draw(last.current);
  }, [draw]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => draw(last.current));
    observer.observe(element);
    return () => observer.disconnect();
  }, [draw]);
  const selected = definitions.find((d) => d.id === measurementId);
  return (
    <canvas
      ref={canvas}
      className="mesh-overlay"
      role="img"
      aria-label={
        layer === 'measurements' && selected
          ? `Construction géométrique : ${selected.name}`
          : 'Repères faciaux détectés en direct'
      }
    />
  );
});
