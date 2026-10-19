import type { FaceDetectionResult, Region } from '../types';
import { definitions } from '../morphometry/metrics';
import {
  angle,
  deroll,
  distance,
  hasFaceBaselines,
  reflectAcrossLine,
} from '../morphometry/geometry';
import connections from './connections.json';
import type { Point } from '../morphometry/geometry';
export interface GeometrySegment {
  from: Point;
  to: Point;
  role: 'numerator' | 'denominator' | 'comparison' | 'projection';
  label: string;
}
export interface GeometryAxis {
  from: Point;
  to: Point;
  label: string;
}
export interface GeometryArc {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  label: string;
  valueDegrees: number;
}
export interface MeasurementGeometry {
  measurementId: string;
  description: string;
  formula: string;
  value: number;
  segments: GeometrySegment[];
  axes: GeometryAxis[];
  arcs: GeometryArc[];
  keypoints: { point: Point; landmark?: number; role: 'landmark' | 'reflected' | 'projection' }[];
}
// Region selection is shared by the static SVG and the imperative Live canvas.
export const regionConnections: Record<Region, { start: number; end: number }[]> = {
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
export const overlayKeypoints = [
  10, 152, 234, 454, 33, 133, 362, 263, 168, 2, 98, 327, 61, 291, 17, 172, 397, 468, 473, 105, 334,
];
export function pointIndices(region: Region): number[] {
  return region === 'all'
    ? overlayKeypoints
    : [...new Set(regionConnections[region].flatMap((e) => [e.start, e.end]))];
}

const explanations: Record<string, string> = {
  'face-ratio': 'Largeur entre les côtés du visage divisée par la hauteur du sommet au menton.',
  'lower-face': 'Distance de la base du nez au menton divisée par la hauteur du visage.',
  'eye-spacing': 'Écart entre les coins internes divisé par la moyenne des deux largeurs des yeux.',
  interocular: 'Distance entre les centres des iris divisée par la largeur du visage.',
  'canthal-tilt':
    'Moyenne des angles des deux yeux par rapport aux horizontales corrigées du roulis. Un coin externe plus haut donne un angle positif.',
  'eye-openness':
    'Moyenne des ouvertures des paupières, chacune divisée par la largeur de son œil.',
  'brow-height':
    'Moyenne des deux séparations verticales sourcil–paupière après correction du roulis, divisée par la largeur du visage. Les pointillés montrent la projection.',
  'brow-spacing':
    'Distance entre les repères internes des sourcils divisée par la largeur du visage.',
  'nose-width': 'Largeur apparente de la base du nez divisée par la largeur du visage.',
  'nose-ratio': 'Largeur apparente de la base du nez divisée par sa hauteur visible.',
  'mouth-width': 'Distance entre les coins de la bouche divisée par la largeur du visage.',
  'mouth-angle':
    'Angle de la ligne des coins de la bouche par rapport à l’horizontale corrigée du roulis. Le signe suit l’axe vertical descendant de l’image.',
  'jaw-ratio':
    'Largeur du contour inférieur entre les repères 172 et 397 divisée par la largeur du visage.',
  'chin-ratio': 'Distance de la lèvre inférieure au menton divisée par la hauteur du visage.',
  symmetry:
    'Écart moyen entre quatre repères et les reflets de leurs homologues autour de l’axe 10–152, divisé par la largeur du visage. Les cercles vides indiquent les reflets.',
};

/** Formula geometry is constructed in derolled image pixels, then mapped back.
 * It describes the current frame, independently of capture/scoring eligibility.
 */
export function buildMeasurementGeometry(
  detection: FaceDetectionResult,
  id: string,
): MeasurementGeometry | null {
  const definition = definitions.find((d) => d.id === id);
  const raw = detection.faces[0];
  if (
    !definition ||
    detection.faces.length !== 1 ||
    !raw ||
    raw.length < 478 ||
    !Number.isFinite(detection.width) ||
    detection.width <= 0 ||
    !Number.isFinite(detection.height) ||
    detection.height <= 0 ||
    !Array.from(raw).every((p) => p && [p.x, p.y, p.z].every(Number.isFinite))
  )
    return null;
  const pixels = raw.map((p) => ({ x: p.x * detection.width, y: p.y * detection.height }));
  if (!hasFaceBaselines(pixels)) return null;
  const roll = angle(pixels[33], pixels[263]);
  const p = deroll(pixels, roll);
  const value = definition.calculate(p);
  if (value === null || !Number.isFinite(value)) return null;
  const radians = (roll * Math.PI) / 180;
  const source = (q: Point): Point => ({
    x: q.x * Math.cos(radians) - q.y * Math.sin(radians),
    y: q.x * Math.sin(radians) + q.y * Math.cos(radians),
  });
  const scene: MeasurementGeometry = {
    measurementId: id,
    description: explanations[id],
    formula: definition.formula,
    value,
    segments: [],
    axes: [],
    arcs: [],
    keypoints: definition.landmarks.map((landmark) => ({
      point: pixels[landmark],
      landmark,
      role: 'landmark',
    })),
  };
  const segment = (from: Point, to: Point, role: GeometrySegment['role'], label: string) =>
    scene.segments.push({ from: source(from), to: source(to), role, label });
  const line = (a: number, b: number, role: GeometrySegment['role'], label: string) =>
    segment(p[a], p[b], role, label);
  const width = () => line(234, 454, 'denominator', 'Largeur du visage');
  const height = () => line(10, 152, 'denominator', 'Hauteur du visage');
  const axis = (from: Point, to: Point, label: string) =>
    scene.axes.push({ from: source(from), to: source(to), label });
  const arc = (
    center: Point,
    radius: number,
    start: number,
    end: number,
    label: string,
    valueDegrees: number,
  ) =>
    scene.arcs.push({
      center: source(center),
      radius,
      startAngle: start + radians,
      endAngle: end + radians,
      label,
      valueDegrees,
    });
  const relativeWidths: Record<string, [number, number, string]> = {
    interocular: [468, 473, 'Distance entre les centres des iris'],
    'brow-spacing': [107, 336, 'Espacement des sourcils'],
    'nose-width': [98, 327, 'Largeur du nez'],
    'mouth-width': [61, 291, 'Largeur de la bouche'],
    'jaw-ratio': [172, 397, 'Largeur du contour inférieur'],
  };
  if (relativeWidths[id]) {
    const [a, b, label] = relativeWidths[id];
    line(a, b, 'numerator', label);
    width();
  } else
    switch (id) {
      case 'face-ratio':
        line(234, 454, 'numerator', 'Largeur du visage');
        height();
        break;
      case 'lower-face':
        line(2, 152, 'numerator', 'Bas du visage');
        height();
        break;
      case 'chin-ratio':
        line(17, 152, 'numerator', 'Lèvre inférieure–menton');
        height();
        break;
      case 'nose-ratio':
        line(98, 327, 'numerator', 'Largeur du nez');
        line(168, 2, 'denominator', 'Hauteur visible du nez');
        break;
      case 'eye-spacing':
        line(133, 362, 'numerator', 'Écart entre les coins internes');
        line(33, 133, 'denominator', 'Largeur de l’œil droit');
        line(263, 362, 'denominator', 'Largeur de l’œil gauche');
        break;
      case 'eye-openness':
        line(159, 145, 'numerator', 'Ouverture droite');
        line(386, 374, 'numerator', 'Ouverture gauche');
        line(33, 133, 'denominator', 'Largeur de l’œil droit');
        line(263, 362, 'denominator', 'Largeur de l’œil gauche');
        break;
      case 'brow-height':
        for (const [brow, eye, label] of [
          [105, 159, 'Séparation droite'],
          [334, 386, 'Séparation gauche'],
        ] as const) {
          const foot = { x: p[brow].x, y: p[eye].y };
          segment(p[brow], foot, 'numerator', label);
          segment(foot, p[eye], 'projection', 'Projection horizontale de la paupière');
          scene.keypoints.push({ point: source(foot), role: 'projection' });
        }
        width();
        break;
      case 'canthal-tilt':
        for (const [outer, inner, label] of [
          [33, 133, 'Inclinaison droite'],
          [263, 362, 'Inclinaison gauche'],
        ] as const) {
          const dx = p[inner].x - p[outer].x,
            dy = p[inner].y - p[outer].y;
          const tilt = Math.atan2(dy, Math.abs(dx));
          const start = dx >= 0 ? 0 : Math.PI;
          line(outer, inner, 'numerator', label);
          axis(p[outer], { x: p[inner].x, y: p[outer].y }, 'Horizontale corrigée du roulis');
          arc(
            p[outer],
            distance(p[outer], p[inner]) * 0.3,
            start,
            start + (dx >= 0 ? tilt : -tilt),
            label,
            (tilt * 180) / Math.PI,
          );
        }
        break;
      case 'mouth-angle': {
        const a = p[61],
          b = p[291];
        const tilt = Math.atan2(b.y - a.y, b.x - a.x);
        line(61, 291, 'numerator', 'Alignement de la bouche');
        axis(a, { x: a.x + distance(a, b), y: a.y }, 'Horizontale corrigée du roulis');
        arc(a, distance(a, b) * 0.3, 0, tilt, 'Angle de la bouche', (tilt * 180) / Math.PI);
        break;
      }
      case 'symmetry':
        axis(p[10], p[152], 'Axe central 10–152');
        for (const [a, b] of [
          [33, 263],
          [133, 362],
          [61, 291],
          [172, 397],
        ]) {
          const reflected = reflectAcrossLine(p[b], p[10], p[152]);
          if (!reflected) return null;
          line(a, b, 'comparison', 'Paire comparée');
          segment(p[a], reflected, 'numerator', 'Écart au reflet');
          scene.keypoints.push({ point: source(reflected), role: 'reflected' });
        }
        width();
        break;
      default:
        return null;
    }
  return scene;
}

export function measurementScenes(
  result: FaceDetectionResult,
  region: Region,
  id?: string,
): MeasurementGeometry[] {
  return definitions
    .filter((d) => (!id || id === d.id) && (region === 'all' || region === d.region))
    .map((d) => buildMeasurementGeometry(result, d.id))
    .filter((s): s is MeasurementGeometry => s !== null);
}
