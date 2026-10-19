import type { Measurement, PSLResult } from '../types';
export { scoreFrontal } from './frontal';
export const DISCLAIMER = 'Experimental PSL estimate — not a scientific beauty rating.';
export interface ScoreConfig {
  version: string;
  weights: number[];
}
export const DEFAULT_CONFIG: ScoreConfig = {
  version: 'psl-heuristic-1.0.0',
  weights: [0.25, 0.2, 0.2, 0.2, 0.15],
};
// These targets are arbitrary product choices, NOT population norms or beauty standards.
const categories = [
  {
    id: 'proportions',
    name: 'Proportions faciales',
    rules: [
      ['face-ratio', 0.78, 0.35],
      ['lower-face', 0.4, 0.25],
    ] as const,
  },
  {
    id: 'eyes',
    name: 'Zone des yeux',
    rules: [
      ['eye-spacing', 1, 0.8],
      ['canthal-tilt', 4, 20],
    ] as const,
  },
  { id: 'symmetry', name: 'Symétrie apparente', rules: [['symmetry', 0, 0.15]] as const },
  {
    id: 'jaw',
    name: 'Mâchoire et menton',
    rules: [
      ['jaw-ratio', 0.78, 0.35],
      ['chin-ratio', 0.2, 0.18],
    ] as const,
  },
  { id: 'profile', name: 'Équilibre du profil', rules: [] },
];
export function score(measurements: Measurement[], config = DEFAULT_CONFIG): PSLResult {
  if (
    config.weights.length !== 5 ||
    config.weights.some((w) => !Number.isFinite(w) || w <= 0) ||
    Math.abs(config.weights.reduce((a, b) => a + b, 0) - 1) > 1e-6
  )
    throw new Error('Les cinq poids doivent être positifs et totaliser 1.');
  const output = categories.map((category, i) => {
    const inputs = category.rules.flatMap(([id, target, tolerance]) => {
      const m = measurements.find((m) => m.id === id);
      if (!m || m.value === null || !Number.isFinite(m.value) || m.confidence === 'unavailable')
        return [];
      return [
        {
          id,
          value: m.value,
          target,
          tolerance,
          score: 8 * Math.max(0, 1 - Math.abs(m.value - target) / tolerance),
        },
      ];
    });
    const available = category.rules.length > 0 && inputs.length === category.rules.length;
    const value = available ? inputs.reduce((s, v) => s + v.score, 0) / inputs.length : null;
    return {
      id: category.id,
      name: category.name,
      weight: config.weights[i],
      score: value,
      contribution: value === null ? null : value * config.weights[i],
      inputs,
      reason: available
        ? undefined
        : category.id === 'profile'
          ? 'Projection du profil non validée avec ce modèle. Aucun score global calculable en V1.'
          : 'Mesures requises indisponibles.',
    };
  });
  return {
    version: config.version,
    score: output.every((c) => c.score !== null)
      ? output.reduce((s, c) => s + c.contribution!, 0)
      : null,
    categories: output,
    missing: output.filter((c) => c.score === null).map((c) => c.name),
    disclaimer: DISCLAIMER,
  };
}
