import type { FaceDetectionResult, Landmark, Region } from '../types';
import canonical from '../vision/canonical.json';
import { definitions } from '../morphometry/metrics';
import {
  measurementScenes,
  pointIndices,
  regionConnections,
  type GeometryArc,
} from '../vision/measurement-geometry';
export type Layer = 'video' | 'points' | 'mesh' | 'measurements';

function arcPath(arc: GeometryArc): string {
  const point = (angle: number) =>
    `${arc.center.x + arc.radius * Math.cos(angle)} ${arc.center.y + arc.radius * Math.sin(angle)}`;
  const delta = arc.endAngle - arc.startAngle;
  return `M ${point(arc.startAngle)} A ${arc.radius} ${arc.radius} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta >= 0 ? 1 : 0} ${point(arc.endAngle)}`;
}
export function Mesh({
  result,
  layer = 'mesh',
  region = 'all',
  illustration = false,
  measurementId,
}: {
  result?: FaceDetectionResult | null;
  layer?: Layer;
  region?: Region;
  illustration?: boolean;
  measurementId?: string;
}) {
  const points: Landmark[] = illustration
    ? canonical
    : result?.faces.length === 1
      ? result.faces[0]
      : [];
  if (!points.length || layer === 'video') return null;
  const width = illustration ? 400 : result!.width;
  const height = illustration ? 520 : result!.height;
  if (![width, height].every((v) => Number.isFinite(v) && v > 0)) return null;
  const detection: FaceDetectionResult = illustration
    ? {
        faces: [points],
        width,
        height,
        timestamp: 0,
        inferenceMs: 0,
        pose: { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' },
        matrix: [],
        blendshapes: {},
      }
    : result!;
  const scenes =
    layer === 'measurements' ? measurementScenes(detection, region, measurementId) : [];
  const selected = definitions.find((d) => d.id === measurementId);
  return (
    <svg
      className={`mesh-overlay ${illustration ? 'canonical-mesh' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={
        illustration
          ? 'Illustration schématique du modèle facial canonique MediaPipe'
          : layer === 'measurements' && selected
            ? `Construction géométrique : ${selected.name}`
            : 'Repères faciaux détectés'
      }
      role="img"
    >
      {layer === 'mesh' &&
        regionConnections[region].map(({ start, end }, i) =>
          points[start] && points[end] ? (
            <line
              key={i}
              x1={points[start].x * width}
              y1={points[start].y * height}
              x2={points[end].x * width}
              y2={points[end].y * height}
              stroke="currentColor"
              strokeWidth={illustration ? 0.45 : 0.65}
              opacity={illustration ? 0.36 + Math.max(0, points[start].z) * 1.5 : 0.55}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
      {layer === 'points' &&
        pointIndices(region).map((i) =>
          points[i] ? (
            <circle
              key={i}
              cx={points[i].x * width}
              cy={points[i].y * height}
              r={width * 0.0035}
              fill="currentColor"
            />
          ) : null,
        )}
      {scenes.map((scene) => (
        <g key={scene.measurementId} data-measurement={scene.measurementId}>
          <title>
            {scene.description} {scene.formula}
          </title>
          {scene.segments.map((s, i) => (
            <line
              key={`s${i}`}
              data-role={s.role}
              x1={s.from.x}
              y1={s.from.y}
              x2={s.to.x}
              y2={s.to.y}
              stroke="currentColor"
              strokeWidth={s.role === 'numerator' ? 2 : 1.4}
              strokeDasharray={
                s.role === 'denominator'
                  ? '6 3'
                  : s.role === 'projection' || s.role === 'comparison'
                    ? '2 3'
                    : undefined
              }
              opacity={s.role === 'comparison' ? 0.45 : 0.95}
              vectorEffect="non-scaling-stroke"
            >
              <title>{s.label}</title>
            </line>
          ))}
          {scene.axes.map((a, i) => (
            <line
              key={`a${i}`}
              data-role="axis"
              x1={a.from.x}
              y1={a.from.y}
              x2={a.to.x}
              y2={a.to.y}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="8 4"
              vectorEffect="non-scaling-stroke"
            >
              <title>{a.label}</title>
            </line>
          ))}
          {scene.arcs.map((a, i) => (
            <path
              key={`arc${i}`}
              d={arcPath(a)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {a.label} : {a.valueDegrees.toFixed(1)}°
              </title>
            </path>
          ))}
          {scene.keypoints.map((k, i) => (
            <circle
              key={`p${i}`}
              data-role={k.role}
              cx={k.point.x}
              cy={k.point.y}
              r={width * 0.0035}
              fill={k.role === 'landmark' ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
