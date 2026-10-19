import type { CaptureQuality, FacePose, FrontalPSLResult, Measurement } from '../types';
import { DISCLAIMER } from './index';

export interface FrontalScoreContext {
  source: 'photo' | 'live' | 'guided';
  quality: CaptureQuality;
  pose: FacePose;
}

// These references and weights are subjective product choices, never population norms.
const categories = [
  {
    id: 'proportions',
    name: 'Proportions faciales',
    weight: 0.3,
    rules: [
      ['face-ratio', 0.78, 0.35],
      ['lower-face', 0.4, 0.25],
    ],
  },
  {
    id: 'eyes',
    name: 'Zone des yeux',
    weight: 0.25,
    rules: [
      ['eye-spacing', 1, 0.8],
      ['canthal-tilt', 4, 20],
    ],
  },
  { id: 'symmetry', name: 'Symétrie apparente', weight: 0.2, rules: [['symmetry', 0, 0.15]] },
  {
    id: 'jaw',
    name: 'Mâchoire et menton',
    weight: 0.25,
    rules: [
      ['jaw-ratio', 0.78, 0.35],
      ['chin-ratio', 0.2, 0.18],
    ],
  },
] as const;

function captureReasons({ quality: q, pose }: FrontalScoreContext): string[] {
  const reasons: string[] = [];
  if (
    !q.valid ||
    !q.frontal ||
    q.label !== 'ready' ||
    q.issues.length ||
    q.neutralExpression !== true
  )
    reasons.push('Capture frontale neutre et valide requise.');
  if (
    q.brightness === null ||
    !Number.isFinite(q.brightness) ||
    q.brightness < 45 ||
    q.brightness > 225 ||
    q.sharpness === null ||
    !Number.isFinite(q.sharpness) ||
    q.sharpness < 12 ||
    !Number.isFinite(q.faceSize) ||
    q.faceSize < 0.28 ||
    (q.stability !== null && (!Number.isFinite(q.stability) || q.stability < 0 || q.stability > 1))
  )
    reasons.push('Qualité lumineuse, netteté, cadrage ou stabilité insuffisants.');
  if (
    pose.source !== 'matrix' ||
    ![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite) ||
    Math.abs(pose.yaw) > 8 ||
    Math.abs(pose.pitch) > 8 ||
    Math.abs(pose.roll) > 20
  )
    reasons.push('Pose trop oblique ou inconnue : score frontal limité à ±8° de yaw/pitch.');
  return reasons;
}

function measurementReason(
  m: Measurement | undefined,
  source: FrontalScoreContext['source'],
): string | null {
  if (!m || m.value === null || !Number.isFinite(m.value) || m.confidence === 'unavailable')
    return 'Mesure obligatoire indisponible.';
  if (
    (m.id === 'symmetry' && m.value < 0) ||
    (m.id === 'canthal-tilt' && Math.abs(m.value) >= 90) ||
    (m.id !== 'symmetry' && m.id !== 'canthal-tilt' && m.value <= 0)
  )
    return 'Mesure obligatoire géométriquement invalide.';
  if (source === 'photo') {
    if (
      (m.spread !== undefined && (!Number.isFinite(m.spread) || m.spread !== 0)) ||
      (m.rawSpread !== undefined && (!Number.isFinite(m.rawSpread) || m.rawSpread !== 0)) ||
      (m.retention !== undefined && m.retention !== 1)
    )
      return 'Dispersion incompatible avec une observation unique.';
    return m.samples === 1 && m.confidence === 'low' && m.reliabilityReason === 'single-photo'
      ? null
      : 'Une photo doit porter une fiabilité limitée et une observation unique.';
  }
  const threshold = Math.max(Math.abs(m.value) * 0.1, m.unit === '°' ? 0.75 : 0.01);
  if (
    !Number.isInteger(m.samples) ||
    m.samples! < 5 ||
    m.confidence !== 'moderate' ||
    m.reliabilityReason ||
    m.spread === undefined ||
    !Number.isFinite(m.spread) ||
    m.spread < 0 ||
    m.spread > threshold ||
    m.rawSpread === undefined ||
    !Number.isFinite(m.rawSpread) ||
    m.rawSpread < 0 ||
    m.rawSpread > threshold ||
    m.retention === undefined ||
    !Number.isFinite(m.retention) ||
    m.retention < 0.75 ||
    m.retention > 1
  )
    return 'Série insuffisante ou instable : au moins 5 observations conservées et 75 % de rétention requis.';
  return null;
}

export function scoreFrontal(
  measurements: Measurement[],
  context: FrontalScoreContext,
): FrontalPSLResult {
  const reasons = captureReasons(context);
  const captureValid = reasons.length === 0;
  const output = categories.map((category) => {
    const problems: string[] = [];
    const inputs = category.rules.flatMap(([id, target, tolerance]) => {
      const matches = measurements.filter((m) => m.id === id);
      const reason =
        matches.length > 1
          ? 'Identifiant de mesure obligatoire dupliqué.'
          : measurementReason(matches[0], context.source);
      if (reason) {
        problems.push(`${id} : ${reason}`);
        return [];
      }
      const value = matches[0].value!;
      return [
        {
          id,
          value,
          target,
          tolerance,
          score: 8 * Math.max(0, 1 - Math.abs(value - target) / tolerance),
        },
      ];
    });
    reasons.push(...problems);
    const available = captureValid && problems.length === 0;
    const value = available
      ? inputs.reduce((sum, input) => sum + input.score, 0) / inputs.length
      : null;
    return {
      id: category.id,
      name: category.name,
      weight: category.weight,
      score: value,
      contribution: value === null ? null : value * category.weight,
      inputs,
      reason: available
        ? undefined
        : !captureValid
          ? 'Conditions de capture du protocole frontal non satisfaites.'
          : problems.join(' '),
    };
  });
  const complete = output.every((c) => c.score !== null);
  if (complete && context.source === 'photo')
    reasons.push('Fiabilité limitée : photo unique, dispersion temporelle inconnue.');
  return {
    version: 'psl-frontal-1.0.0',
    score: complete ? output.reduce((sum, c) => sum + c.contribution!, 0) : null,
    categories: output,
    missing: output.filter((c) => c.score === null).map((c) => c.name),
    disclaimer: DISCLAIMER,
    reliability: complete ? (context.source === 'photo' ? 'limited' : 'moderate') : 'unavailable',
    reasons,
  };
}
