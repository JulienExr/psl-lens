import type { FaceDetectionResult, Landmark, Region } from '../types';
import connections from '../vision/connections.json';
import canonical from '../vision/canonical.json';
import { definitions } from '../morphometry/metrics';
export type Layer = 'video' | 'points' | 'mesh' | 'measurements';
const groups: Record<Region, { start: number; end: number }[]> = {
  all: connections.TESSELATION,
  face: connections.FACE_OVAL,
  eyes: [
    ...connections.LEFT_EYE,
    ...connections.RIGHT_EYE,
    ...connections.LEFT_IRIS,
    ...connections.RIGHT_IRIS,
  ],
  brows: [...connections.LEFT_EYEBROW, ...connections.RIGHT_EYEBROW],
  nose: [
    { start: 168, end: 2 },
    { start: 98, end: 327 },
  ],
  mouth: connections.LIPS,
  jaw: connections.FACE_OVAL.filter((e) =>
    [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397].includes(e.start),
  ),
};
const keypoints = [
  10, 152, 234, 454, 33, 133, 362, 263, 168, 2, 98, 327, 61, 291, 17, 172, 397, 468, 473, 105, 334,
];
export function Mesh({
  result,
  layer = 'mesh',
  region = 'all',
  illustration = false,
}: {
  result?: FaceDetectionResult | null;
  layer?: Layer;
  region?: Region;
  illustration?: boolean;
}) {
  const points: Landmark[] = illustration
    ? canonical
    : result?.faces.length === 1
      ? result.faces[0]
      : [];
  if (!points.length || layer === 'video') return null;
  // ViewBox uses true image dimensions; SVG and media share one aspect-ratio container.
  const width = illustration ? 400 : result!.width;
  const height = illustration ? 520 : result!.height;
  const lines =
    layer === 'measurements'
      ? definitions
          .filter((m) => region === 'all' || region === m.region)
          .map((m) => ({ start: m.landmarks[0], end: m.landmarks[1] }))
      : groups[region];
  return (
    <svg
      className={`mesh-overlay ${illustration ? 'canonical-mesh' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={
        illustration
          ? 'Illustration schématique du modèle facial canonique MediaPipe'
          : 'Repères faciaux détectés'
      }
      role="img"
    >
      {layer !== 'points' &&
        lines.map(({ start, end }, i) =>
          points[start] && points[end] ? (
            <line
              key={i}
              x1={points[start].x * width}
              y1={points[start].y * height}
              x2={points[end].x * width}
              y2={points[end].y * height}
              stroke="currentColor"
              strokeWidth={illustration ? 0.45 : layer === 'measurements' ? 1.7 : 0.65}
              opacity={illustration ? 0.36 + Math.max(0, points[start].z) * 1.5 : 0.55}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
      {(layer === 'points'
        ? keypoints
        : layer === 'measurements'
          ? [...new Set(lines.flatMap((l) => [l.start, l.end]))]
          : []
      ).map((i) =>
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
    </svg>
  );
}
