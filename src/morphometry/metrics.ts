import type { CaptureQuality, FaceDetectionResult, Measurement, Region } from '../types';
import {
  angle,
  deroll,
  distance,
  hasFaceBaselines,
  ratio,
  reflectAcrossLine,
  type Point,
} from './geometry';

type Definition = Omit<Measurement, 'value' | 'confidence'> & {
  calculate: (p: Point[]) => number | null;
};
const d = (p: Point[], a: number, b: number) => distance(p[a], p[b]);
const w = (p: Point[]) => d(p, 234, 454);
const h = (p: Point[]) => d(p, 10, 152);
const relative = (p: Point[], a: number, b: number) => ratio(d(p, a, b), w(p));
function def(
  id: string,
  name: string,
  region: Region,
  landmarks: number[],
  formula: string,
  calculate: Definition['calculate'],
  unit: 'ratio' | '°' = 'ratio',
): Definition {
  return {
    id,
    name,
    region,
    landmarks,
    formula,
    calculate,
    unit,
    description: `${name}, calculé dans le plan de l’image après correction de l’inclinaison.`,
    limitation:
      'Estimation 2D apparente. Dépend de la perspective, de l’expression et des repères prédits. Aucune distance physique ou osseuse.',
  };
}
export const definitions: Definition[] = [
  def(
    'face-ratio',
    'Largeur / hauteur du visage',
    'face',
    [234, 454, 10, 152],
    'd(234,454) / d(10,152)',
    (p) => ratio(w(p), h(p)),
  ),
  def('lower-face', 'Part du bas du visage', 'face', [2, 152, 10], 'd(2,152) / d(10,152)', (p) =>
    ratio(d(p, 2, 152), h(p)),
  ),
  def(
    'eye-spacing',
    'Écartement relatif des yeux',
    'eyes',
    [133, 362, 33, 263],
    'd(133,362) / moyenne(d(33,133),d(263,362))',
    (p) => ratio(d(p, 133, 362), (d(p, 33, 133) + d(p, 263, 362)) / 2),
  ),
  def(
    'interocular',
    'Distance interoculaire relative',
    'eyes',
    [468, 473, 234, 454],
    'd(468,473) / largeur visage',
    (p) => relative(p, 468, 473),
  ),
  def(
    'canthal-tilt',
    'Inclinaison apparente des yeux',
    'eyes',
    [33, 133, 362, 263],
    'moyenne(atan2(y133−y33,|x133−x33|), atan2(y362−y263,|x362−x263|))',
    (p) =>
      ((Math.atan2(p[133].y - p[33].y, Math.abs(p[133].x - p[33].x)) +
        Math.atan2(p[362].y - p[263].y, Math.abs(p[362].x - p[263].x))) *
        90) /
      Math.PI,
    '°',
  ),
  def(
    'eye-openness',
    'Ouverture relative des yeux',
    'eyes',
    [159, 145, 386, 374, 33, 133, 263, 362],
    'moyenne(d(159,145)/d(33,133),d(386,374)/d(263,362))',
    (p) => {
      const a = ratio(d(p, 159, 145), d(p, 33, 133));
      const b = ratio(d(p, 386, 374), d(p, 263, 362));
      return a === null || b === null ? null : (a + b) / 2;
    },
  ),
  def(
    'brow-height',
    'Séparation verticale sourcils–paupières',
    'brows',
    [105, 159, 334, 386, 234, 454],
    'moyenne(y159−y105,y386−y334) / largeur visage, après dérotation',
    (p) => {
      const right = p[159].y - p[105].y;
      const left = p[386].y - p[334].y;
      return right > 1e-8 && left > 1e-8 ? ratio((right + left) / 2, w(p)) : null;
    },
  ),
  def(
    'brow-spacing',
    'Espacement des sourcils',
    'brows',
    [107, 336, 234, 454],
    'd(107,336) / largeur visage',
    (p) => relative(p, 107, 336),
  ),
  def(
    'nose-width',
    'Largeur basale apparente du nez',
    'nose',
    [98, 327, 234, 454],
    'd(98,327) / largeur visage',
    (p) => relative(p, 98, 327),
  ),
  def(
    'nose-ratio',
    'Largeur / hauteur visible du nez',
    'nose',
    [98, 327, 168, 2],
    'd(98,327) / d(168,2)',
    (p) => ratio(d(p, 98, 327), d(p, 168, 2)),
  ),
  def(
    'mouth-width',
    'Largeur relative de la bouche',
    'mouth',
    [61, 291, 234, 454],
    'd(61,291) / largeur visage',
    (p) => (d(p, 61, 291) > w(p) * 1e-4 ? relative(p, 61, 291) : null),
  ),
  def(
    'mouth-angle',
    'Alignement de la bouche',
    'mouth',
    [61, 291],
    'atan2(y291−y61,x291−x61), corrigé du roulis des yeux',
    (p) => (d(p, 61, 291) > w(p) * 1e-4 ? angle(p[61], p[291]) : null),
    '°',
  ),
  def(
    'jaw-ratio',
    'Largeur relative du contour inférieur',
    'jaw',
    [172, 397, 234, 454],
    'd(172,397) / largeur visage',
    (p) => relative(p, 172, 397),
  ),
  def(
    'chin-ratio',
    'Distance lèvre inférieure–menton relative',
    'jaw',
    [17, 152, 10],
    'd(17,152) / hauteur visage',
    (p) => ratio(d(p, 17, 152), h(p)),
  ),
  def(
    'symmetry',
    'Écart de symétrie apparent',
    'face',
    [10, 152, 33, 263, 133, 362, 61, 291, 172, 397, 234, 454],
    'moyenne(distance(point droit, reflet point gauche autour axe 10–152)) / largeur visage',
    (p) => {
      const pairs = [
        [33, 263],
        [133, 362],
        [61, 291],
        [172, 397],
      ];
      const reflected = pairs.map(([, b]) => reflectAcrossLine(p[b], p[10], p[152]));
      if (reflected.some((v) => v === null)) return null;
      return ratio(
        pairs.reduce((sum, [a], i) => sum + distance(p[a], reflected[i]!), 0) / pairs.length,
        w(p),
      );
    },
  ),
];

export function measure(
  result: FaceDetectionResult,
  quality: CaptureQuality,
  options: { allowApproximate?: boolean } = {},
): Measurement[] {
  const raw = result.faces[0] ?? [];
  const complete =
    result.faces.length === 1 &&
    Number.isFinite(result.width) &&
    result.width > 0 &&
    Number.isFinite(result.height) &&
    result.height > 0 &&
    Number.isFinite(result.timestamp) &&
    raw.length >= 478 &&
    raw.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  const points = complete
    ? raw.map((p) => ({ x: p.x * result.width, y: p.y * result.height }))
    : [];
  const geometryValid = complete && hasFaceBaselines(points);
  const corrected = geometryValid ? deroll(points, angle(points[33], points[263])) : [];
  const frontal =
    result.pose.source === 'matrix' &&
    [result.pose.yaw, result.pose.pitch, result.pose.roll].every(Number.isFinite) &&
    Math.abs(result.pose.yaw) <= 12 &&
    Math.abs(result.pose.pitch) <= 12 &&
    Math.abs(result.pose.roll) <= 20;
  const verified = frontal && quality.valid && quality.frontal;
  return definitions.map(({ calculate, ...definition }) => {
    const value =
      geometryValid && (verified || options.allowApproximate) ? calculate(corrected) : null;
    const usable = value !== null && Number.isFinite(value);
    return {
      ...definition,
      value: usable ? value : null,
      confidence: usable ? (verified ? 'moderate' : 'low') : 'unavailable',
      ...(usable && !verified ? { reliabilityReason: 'capture-quality' as const } : {}),
      reason:
        usable && !verified
          ? 'Estimation indicative : la pose ou la qualité de capture peuvent déformer cette mesure.'
          : usable
            ? undefined
            : !geometryValid
              ? 'Repères absents, invalides ou plusieurs visages.'
              : !quality.frontal || !frontal
                ? 'Une vue frontale est nécessaire (rotation ≤ 12°).'
                : quality.issues.join(' ') ||
                  'Construction géométrique dégénérée ou repères incohérents.',
    };
  });
}
