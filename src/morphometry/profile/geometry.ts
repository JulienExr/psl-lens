import type { ProfileAnalysis, ProfilePoint, ProfilePointId } from '../../types/v2';

export interface ProfileGeometryPoint {
  x: number;
  y: number;
}
export interface ProfileGeometrySegment {
  from: ProfileGeometryPoint;
  to: ProfileGeometryPoint;
  role: 'numerator' | 'denominator' | 'projection' | 'reference' | 'ray';
  label: string;
}
export interface ProfileGeometryArc {
  center: ProfileGeometryPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  valueDegrees: number;
  label: string;
}
export interface ProfileGeometry {
  measurementId: string;
  formula: string;
  description: string;
  value: number;
  segments: ProfileGeometrySegment[];
  arcs: ProfileGeometryArc[];
  points: {
    point: ProfileGeometryPoint;
    landmark?: ProfilePointId;
    role: 'landmark' | 'projection';
    label: string;
  }[];
}

const sub = (a: ProfileGeometryPoint, b: ProfileGeometryPoint): ProfileGeometryPoint => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const dot = (a: ProfileGeometryPoint, b: ProfileGeometryPoint) => a.x * b.x + a.y * b.y;
const length = (v: ProfileGeometryPoint) => Math.hypot(v.x, v.y);
const addScaled = (
  origin: ProfileGeometryPoint,
  vector: ProfileGeometryPoint,
  scale: number,
): ProfileGeometryPoint => ({ x: origin.x + vector.x * scale, y: origin.y + vector.y * scale });
const valid = (point: ProfilePoint | undefined): point is ProfilePoint =>
  !!point &&
  point.confirmed &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  point.x >= 0 &&
  point.x <= 1 &&
  point.y >= 0 &&
  point.y <= 1;
const labels: Record<ProfilePointId, string> = {
  nasion: 'N · Racine du nez',
  pronasale: 'Prn · Pointe du nez',
  subnasale: 'Sn · Base du nez',
  upperLip: 'Ls · Lèvre supérieure',
  lowerLip: 'Li · Lèvre inférieure',
  pogonion: 'Pg · Avant du menton',
  menton: 'Me · Bas du menton',
  cervical: 'C · Transition du cou',
};
const descriptions: Record<string, string> = {
  'nose-projection':
    'Projection signée de Sn vers Prn suivant u, perpendiculaire à N–Me et orienté vers la pointe du nez, divisée par la longueur N–Me. Les pointillés relient Prn à sa projection.',
  'chin-projection':
    'Projection signée de Sn vers Pg suivant le même axe u orienté vers le nez, divisée par N–Me. Une valeur négative place la projection de Pg derrière Sn suivant cet axe.',
  'profile-angle':
    'Angle intérieur entre les demi-droites Sn–N et Sn–Pg, de sommet Sn. L’arc montre l’angle mesuré dans le plan de l’image.',
  'upper-lip-offset':
    'Distance perpendiculaire de la lèvre supérieure à la droite Prn–Pg, divisée par N–Me. Le signe est positif dans le sens de la normale orientée vers u, et négatif dans le sens opposé.',
  'lower-lip-offset':
    'Distance perpendiculaire de la lèvre inférieure à la droite Prn–Pg, divisée par N–Me. Le signe est positif dans le sens de la normale orientée vers u, et négatif dans le sens opposé.',
  'lower-profile-share':
    'Longueur du segment Sn–Me divisée par celle du segment N–Me. Les deux distances sont mesurées en pixels de l’image, sans dimension physique.',
  'chin-neck-angle':
    'Angle intérieur entre les demi-droites Me–Pg et Me–C, de sommet Me. Il décrit uniquement la transition cutanée visible et pointée sur cette photo.',
};

/** Constructs the formula in source-image pixels using the engine's N–Me basis.
 * Synthetic projection feet are explicitly distinguished from confirmed landmarks.
 */
export function buildProfileGeometry(
  profile: ProfileAnalysis,
  measurementId: string,
): ProfileGeometry | null {
  const metric = profile.measurements.find((measurement) => measurement.id === measurementId);
  const { width, height, points } = profile;
  if (
    !metric ||
    !(measurementId in descriptions) ||
    metric.value === null ||
    !Number.isFinite(metric.value) ||
    !profile.quality.valid ||
    !profile.orientation.strictProfileConfirmed ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const required: ProfilePointId[] = ['nasion', 'menton', 'pronasale', 'subnasale', 'pogonion'];
  const dependencies: Record<string, ProfilePointId[]> = {
    'nose-projection': ['nasion', 'menton', 'pronasale', 'subnasale'],
    'chin-projection': ['nasion', 'menton', 'subnasale', 'pogonion'],
    'profile-angle': ['nasion', 'subnasale', 'pogonion'],
    'upper-lip-offset': ['nasion', 'menton', 'pronasale', 'pogonion', 'upperLip'],
    'lower-lip-offset': ['nasion', 'menton', 'pronasale', 'pogonion', 'lowerLip'],
    'lower-profile-share': ['nasion', 'menton', 'subnasale'],
    'chin-neck-angle': ['pogonion', 'menton', 'cervical'],
  };
  const ids = dependencies[measurementId];
  if (![...required, ...ids].every((id) => valid(points[id]))) return null;
  const px = (id: ProfilePointId): ProfileGeometryPoint => ({
    x: points[id]!.x * width,
    y: points[id]!.y * height,
  });
  const n = px('nasion'),
    me = px('menton'),
    prn = px('pronasale'),
    sn = px('subnasale'),
    pg = px('pogonion');
  const h = length(sub(me, n));
  if (h <= 0.05 * Math.hypot(width, height)) return null;
  const v = { x: (me.x - n.x) / h, y: (me.y - n.y) / h };
  let u = { x: v.y, y: -v.x };
  if (dot(sub(prn, n), u) < 0) u = { x: -u.x, y: -u.y };
  const snPosition = dot(sub(sn, n), v) / h,
    pgPosition = dot(sub(pg, n), v) / h;
  if (!(
    snPosition > 0 &&
    snPosition < 1 &&
    pgPosition > snPosition &&
    pgPosition <= 1.2 &&
    Math.abs(dot(sub(prn, n), u)) > 0.01 * h
  ))
    return null;

  const scene: ProfileGeometry = {
    measurementId,
    formula: metric.formula,
    description: descriptions[measurementId],
    value: 0,
    segments: [],
    arcs: [],
    points: ids.map((id) => ({ point: px(id), landmark: id, role: 'landmark', label: labels[id] })),
  };
  const segment = (
    from: ProfileGeometryPoint,
    to: ProfileGeometryPoint,
    role: ProfileGeometrySegment['role'],
    label: string,
  ) => scene.segments.push({ from, to, role, label });
  const denominator = () => segment(n, me, 'denominator', 'Référence N–Me');
  const projectionPoint = (point: ProfileGeometryPoint, label: string) =>
    scene.points.push({ point, role: 'projection', label });
  const arc = (
    a: ProfileGeometryPoint,
    center: ProfileGeometryPoint,
    c: ProfileGeometryPoint,
    label: string,
  ): boolean => {
    const first = sub(a, center),
      second = sub(c, center);
    if (length(first) * length(second) <= 1e-9) return false;
    const delta = Math.atan2(first.x * second.y - first.y * second.x, dot(first, second));
    const startAngle = Math.atan2(first.y, first.x);
    const valueDegrees = (Math.abs(delta) * 180) / Math.PI;
    segment(center, a, 'ray', label + ' · premier côté');
    segment(center, c, 'ray', label + ' · second côté');
    scene.arcs.push({
      center,
      radius: Math.min(length(first), length(second)) * 0.22,
      startAngle,
      endAngle: startAngle + delta,
      valueDegrees,
      label,
    });
    scene.value = valueDegrees;
    return true;
  };

  switch (measurementId) {
    case 'nose-projection':
    case 'chin-projection': {
      const target = measurementId === 'nose-projection' ? prn : pg;
      const distance = dot(sub(target, sn), u);
      const foot = addScaled(sn, u, distance);
      segment(sn, foot, 'numerator', 'Projection signée suivant u');
      segment(target, foot, 'projection', 'Connecteur perpendiculaire à u');
      denominator();
      projectionPoint(foot, 'Projection sur l’axe u passant par Sn');
      scene.value = distance / h;
      break;
    }
    case 'upper-lip-offset':
    case 'lower-lip-offset': {
      const lip = px(measurementId === 'upper-lip-offset' ? 'upperLip' : 'lowerLip');
      const line = sub(pg, prn),
        lineLength = length(line);
      if (lineLength < 1e-9) return null;
      const amount = dot(sub(lip, prn), line) / (lineLength * lineLength);
      const foot = addScaled(prn, line, amount);
      let normal = { x: line.y / lineLength, y: -line.x / lineLength };
      if (dot(normal, u) < 0) normal = { x: -normal.x, y: -normal.y };
      segment(prn, pg, 'reference', 'Ligne Prn–Pg (E-line)');
      if (amount < 0 || amount > 1)
        segment(amount < 0 ? prn : pg, foot, 'reference', 'Prolongement de la droite Prn–Pg');
      segment(foot, lip, 'numerator', 'Distance perpendiculaire signée à la ligne Prn–Pg');
      denominator();
      projectionPoint(foot, 'Pied de la perpendiculaire sur Prn–Pg');
      scene.value = dot(sub(lip, prn), normal) / h;
      break;
    }
    case 'lower-profile-share':
      segment(sn, me, 'numerator', 'Longueur Sn–Me');
      denominator();
      scene.value = length(sub(sn, me)) / h;
      break;
    case 'profile-angle':
      if (!arc(n, sn, pg, 'Angle N–Sn–Pg')) return null;
      break;
    case 'chin-neck-angle':
      if (!arc(pg, me, px('cervical'), 'Angle Pg–Me–C')) return null;
      break;
  }
  return Number.isFinite(scene.value) ? scene : null;
}
