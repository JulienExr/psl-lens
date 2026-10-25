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
    reasons.push(
      'Qualité de capture à améliorer : cette estimation est à interpréter avec prudence.',
    );
  reasons.push(...q.issues);
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
    reasons.push(
      'Pose oblique ou inconnue : les proportions apparentes peuvent être déformées. Reprenez de face pour affiner le score.',
    );
  return reasons;
}

function measurementReason(
  m: Measurement | undefined,
  source: FrontalScoreContext['source'],
): string | null {
  if (!m || m.value === null || !Number.isFinite(m.value) || m.confidence === 'unavailable')
    return 'Une mesure est indisponible et exclue de l’estimation.';
  if (
    (m.id === 'symmetry' && m.value < 0) ||
    (m.id === 'canthal-tilt' && Math.abs(m.value) >= 90) ||
    (m.id !== 'symmetry' && m.id !== 'canthal-tilt' && m.value <= 0)
  )
    return 'Une construction géométrique est invalide et exclue de l’estimation.';
  if (source === 'photo') {
    if (
      (m.spread !== undefined && (!Number.isFinite(m.spread) || m.spread !== 0)) ||
      (m.rawSpread !== undefined && (!Number.isFinite(m.rawSpread) || m.rawSpread !== 0)) ||
      (m.retention !== undefined && m.retention !== 1)
    )
      return 'Dispersion incompatible avec une observation unique.';
    return m.samples === 1 && m.confidence === 'low' && m.reliabilityReason === 'single-photo'
      ? null
      : 'Fiabilité limitée : la répétabilité de cette photo n’est pas vérifiée.';
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
    return 'Série courte, dispersée ou peu retenue : prolongez une capture stable pour affiner le score.';
  return null;
}

export function scoreFrontal(
  measurements: Measurement[],
  context: FrontalScoreContext,
): FrontalPSLResult {
  const reasons = captureReasons(context);
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
        reasons.push(reason);
      }
      const m = matches[0];
      if (
        matches.length !== 1 ||
        !m ||
        m.value === null ||
        !Number.isFinite(m.value) ||
        m.confidence === 'unavailable' ||
        (id === 'symmetry'
          ? m.value < 0
          : id === 'canthal-tilt'
            ? Math.abs(m.value) >= 90
            : m.value <= 0)
      )
        return [];
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
    const coverage = inputs.length / category.rules.length;
    const value = inputs.length
      ? inputs.reduce((sum, input) => sum + input.score, 0) / inputs.length
      : null;
    return {
      id: category.id,
      name: category.name,
      weight: category.weight,
      score: value,
      contribution: value === null ? null : value * category.weight * coverage,
      coverage,
      inputs,
      reason: problems.length ? problems.join(' ') : undefined,
    };
  });
  const coverage = output.reduce((sum, c) => sum + c.weight * c.coverage, 0);
  if (coverage > 0 && coverage < 1)
    reasons.push(
      'Couverture partielle : le score est normalisé sur les seules mesures disponibles. Les mesures absentes ne sont pas estimées.',
    );
  if (coverage > 0 && context.source === 'photo')
    reasons.push('Fiabilité limitée : photo unique, dispersion temporelle inconnue.');
  return {
    version: 'psl-frontal-1.1.0',
    score:
      coverage > 0
        ? Math.max(
            0,
            Math.min(8, output.reduce((sum, c) => sum + (c.contribution ?? 0), 0) / coverage),
          )
        : null,
    coverage,
    categories: output.map((c) => ({
      ...c,
      contribution: c.contribution === null ? null : c.contribution / coverage,
    })),
    missing: output.filter((c) => c.coverage < 1).map((c) => c.name),
    disclaimer: DISCLAIMER,
    reliability: coverage > 0 ? (reasons.length ? 'limited' : 'moderate') : 'unavailable',
    reasons: [...new Set(reasons)],
  };
}
