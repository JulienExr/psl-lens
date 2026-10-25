import type {
  ProfileAnalysis,
  ProfileMeasurement,
  ProfilePoint,
  ProfilePointId,
} from '../../types/v2';
export const PROFILE_VERSION = 'profile-2d-2.0.0' as const;
export const PROFILE_POINTS: {
  id: ProfilePointId;
  name: string;
  help: string;
  required: boolean;
}[] = [
  {
    id: 'nasion',
    name: 'Racine du nez',
    help: 'Creux visible entre le front et le dos du nez (nasion cutané).',
    required: true,
  },
  {
    id: 'pronasale',
    name: 'Pointe du nez',
    help: 'Point le plus avancé de la pointe du nez.',
    required: true,
  },
  {
    id: 'subnasale',
    name: 'Base du nez',
    help: 'Jonction visible entre la base du nez et la lèvre supérieure.',
    required: true,
  },
  {
    id: 'upperLip',
    name: 'Lèvre supérieure',
    help: 'Point le plus avancé du bord rouge de la lèvre supérieure, bouche au repos.',
    required: false,
  },
  {
    id: 'lowerLip',
    name: 'Lèvre inférieure',
    help: 'Point le plus avancé du bord rouge de la lèvre inférieure.',
    required: false,
  },
  {
    id: 'pogonion',
    name: 'Avant du menton',
    help: 'Point cutané le plus avancé du menton (pogonion).',
    required: true,
  },
  {
    id: 'menton',
    name: 'Bas du menton',
    help: 'Point le plus bas du contour cutané du menton.',
    required: true,
  },
  {
    id: 'cervical',
    name: 'Transition du cou',
    help: 'Creux visible de la transition sous-mentonnière vers le cou. Facultatif si masqué.',
    required: false,
  },
];
type Vec = { x: number; y: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const length = (a: Vec) => Math.hypot(a.x, a.y);
const angle = (a: Vec, b: Vec, c: Vec) => {
  const u = sub(a, b),
    v = sub(c, b),
    d = length(u) * length(v);
  return d > 1e-9 ? (Math.atan2(Math.abs(u.x * v.y - u.y * v.x), dot(u, v)) * 180) / Math.PI : null;
};
const valid = (p: ProfilePoint | undefined): p is ProfilePoint =>
  !!p &&
  p.confirmed &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1;
export interface ProfileInput {
  points: Partial<Record<ProfilePointId, ProfilePoint>>;
  width: number;
  height: number;
  side: ProfileAnalysis['side'];
  strictProfileConfirmed: boolean;
  source: ProfileAnalysis['source'];
  preview?: string;
}
export function analyzeProfile(input: ProfileInput): ProfileAnalysis {
  const { width, height, points } = input;
  const px = (id: ProfilePointId): Vec => ({ x: points[id]!.x * width, y: points[id]!.y * height });
  const required = PROFILE_POINTS.filter((p) => p.required);
  const warnings: string[] = [
    'Placement assisté : exactitude des repères non validée par un expert.',
    'Projection 2D sensible à la perspective, à la pose, aux occlusions et au placement.',
  ];
  let geometryValid =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    required.every((p) => valid(points[p.id]));
  let h = 0,
    u: Vec = { x: 0, y: 0 };
  if (geometryValid) {
    const n = px('nasion'),
      me = px('menton');
    h = length(sub(me, n));
    geometryValid = h > 0.05 * Math.hypot(width, height);
    if (geometryValid) {
      const v = { x: (me.x - n.x) / h, y: (me.y - n.y) / h };
      u = { x: v.y, y: -v.x };
      if (dot(sub(px('pronasale'), n), u) < 0) u = { x: -u.x, y: -u.y };
      const sn = dot(sub(px('subnasale'), n), v) / h;
      const pg = dot(sub(px('pogonion'), n), v) / h;
      geometryValid =
        sn > 0 &&
        sn < 1 &&
        pg > sn &&
        pg <= 1.2 &&
        Math.abs(dot(sub(px('pronasale'), n), u)) > 0.01 * h;
    }
  }
  const enabled = geometryValid && input.strictProfileConfirmed;
  if (!input.strictProfileConfirmed)
    warnings.push('La vue latérale et le placement doivent être explicitement confirmés.');
  if (!geometryValid)
    warnings.push(
      'Repères de référence absents, non confirmés, hors image ou géométrie dégénérée/incohérente.',
    );
  if (input.side === 'unknown')
    warnings.push(
      'Côté anatomique non déclaré; le sens dans l’image ne détermine pas le côté anatomique.',
    );
  const definitions: {
    id: string;
    name: string;
    ids: ProfilePointId[];
    unit: 'ratio' | '°';
    formula: string;
    calculate: () => number | null;
  }[] = [
    {
      id: 'nose-projection',
      name: 'Projection apparente du nez',
      ids: ['nasion', 'menton', 'pronasale', 'subnasale'],
      unit: 'ratio',
      formula: 'dot(Prn − Sn, u) / |N − Me|',
      calculate: () => dot(sub(px('pronasale'), px('subnasale')), u) / h,
    },
    {
      id: 'chin-projection',
      name: 'Projection apparente du menton',
      ids: ['nasion', 'menton', 'subnasale', 'pogonion'],
      unit: 'ratio',
      formula: 'dot(Pg − Sn, u) / |N − Me|',
      calculate: () => dot(sub(px('pogonion'), px('subnasale')), u) / h,
    },
    {
      id: 'profile-angle',
      name: 'Angle apparent du profil',
      ids: ['nasion', 'subnasale', 'pogonion'],
      unit: '°',
      formula: 'angle(N, Sn, Pg)',
      calculate: () => angle(px('nasion'), px('subnasale'), px('pogonion')),
    },
    ...(['upperLip', 'lowerLip'] as const).map((id) => ({
      id: id === 'upperLip' ? 'upper-lip-offset' : 'lower-lip-offset',
      name:
        id === 'upperLip'
          ? 'Lèvre supérieure / ligne nez–menton'
          : 'Lèvre inférieure / ligne nez–menton',
      ids: ['nasion', 'menton', 'pronasale', 'pogonion', id] as ProfilePointId[],
      unit: 'ratio' as const,
      formula: 'distance signée(L, ligne Prn–Pg) / |N − Me|',
      calculate: () => {
        const line = sub(px('pogonion'), px('pronasale')),
          len = length(line);
        if (len < 1e-9) return null;
        let normal = { x: line.y / len, y: -line.x / len };
        if (dot(normal, u) < 0) normal = { x: -normal.x, y: -normal.y };
        return dot(sub(px(id), px('pronasale')), normal) / h;
      },
    })),
    {
      id: 'lower-profile-share',
      name: 'Part latérale inférieure',
      ids: ['nasion', 'menton', 'subnasale'],
      unit: 'ratio',
      formula: '|Sn − Me| / |N − Me|',
      calculate: () => length(sub(px('subnasale'), px('menton'))) / h,
    },
    {
      id: 'chin-neck-angle',
      name: 'Transition apparente menton–cou',
      ids: ['pogonion', 'menton', 'cervical'],
      unit: '°',
      formula: 'angle(Pg, Me, C)',
      calculate: () => angle(px('pogonion'), px('menton'), px('cervical')),
    },
  ];
  const measurements: ProfileMeasurement[] = definitions.map((d) => {
    const available = enabled && d.ids.every((id) => valid(points[id]));
    const computed = available ? d.calculate() : null;
    const value = computed !== null && Number.isFinite(computed) ? computed : null;
    return {
      id: d.id,
      name: d.name,
      value,
      unit: d.unit,
      formula: d.formula,
      landmarks: d.ids,
      method: 'assisted',
      version: PROFILE_VERSION,
      quality: value === null ? 'unavailable' : 'limited',
      reason:
        value === null ? 'Repères confirmés ou géométrie nécessaires indisponibles.' : undefined,
      samples: value === null ? 0 : 1,
      uncertainties: [...warnings],
    };
  });
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    side: input.side,
    facing: geometryValid ? (u.x >= 0 ? 'image-right' : 'image-left') : 'undetermined',
    width,
    height,
    preview: input.preview,
    points: structuredClone(points),
    measurements,
    quality: {
      valid: enabled,
      warnings,
      completeness: measurements.filter((m) => m.value !== null).length / measurements.length,
    },
    method: 'assisted',
    algorithm: PROFILE_VERSION,
    source: input.source,
    orientation: { method: 'user-declared', strictProfileConfirmed: input.strictProfileConfirmed },
  };
}
