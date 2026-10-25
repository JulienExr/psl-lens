import type { AggregatedAnalysis } from '../types';
import type { MultiViewScore, ProfileAnalysis } from '../types/v2';
import { DISCLAIMER } from './index';
// Product references for exploration only: not beauty standards or population statistics.
export const MULTIVIEW_CONFIG = {
  version: 'psl-multiview-2.0.0',
  frontalWeight: 0.7,
  rules: [
    {
      id: 'nose-projection',
      name: 'Projection apparente du nez',
      weight: 0.1,
      target: 0.1,
      tolerance: 0.15,
    },
    {
      id: 'chin-projection',
      name: 'Projection apparente du menton',
      weight: 0.1,
      target: 0,
      tolerance: 0.15,
    },
    {
      id: 'profile-angle',
      name: 'Angle apparent du profil',
      weight: 0.1,
      target: 165,
      tolerance: 35,
    },
  ],
} as const;
export function scoreMultiview(
  frontal: AggregatedAnalysis | null,
  profiles: ProfileAnalysis[],
): MultiViewScore {
  const config = MULTIVIEW_CONFIG;
  const usable = (p: ProfileAnalysis) =>
    p.quality.valid &&
    p.orientation.strictProfileConfirmed &&
    p.method === 'assisted' &&
    p.algorithm === 'profile-2d-2.0.0';
  const selected = [...profiles]
    .filter(usable)
    .sort(
      (a, b) =>
        b.measurements.filter((m) => m.value !== null && Number.isFinite(m.value)).length -
          a.measurements.filter((m) => m.value !== null && Number.isFinite(m.value)).length ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    )[0];
  const f = frontal?.frontalScore;
  const categories = [
    {
      id: 'frontal',
      name: 'Protocole frontal compatible',
      weight: config.frontalWeight,
      score: f?.score ?? null,
      contribution: null as number | null,
      coverage: f?.score !== null && f?.score !== undefined ? f.coverage : 0,
      inputs: [] as {
        id: string;
        value: number;
        target: number;
        tolerance: number;
        score: number;
      }[],
    },
    ...config.rules.map((rule) => {
      const matches = selected?.measurements.filter((m) => m.id === rule.id) ?? [];
      const m = matches[0];
      const value =
        matches.length === 1 &&
        m?.method === 'assisted' &&
        m.quality !== 'unavailable' &&
        m.value !== null &&
        Number.isFinite(m.value)
          ? m.value
          : null;
      const score =
        value === null ? null : 8 * Math.max(0, 1 - Math.abs(value - rule.target) / rule.tolerance);
      return {
        id: rule.id,
        name: rule.name,
        weight: rule.weight,
        score,
        contribution: null as number | null,
        coverage: score === null ? 0 : 1,
        inputs:
          value === null
            ? []
            : [
                {
                  id: rule.id,
                  value,
                  target: rule.target,
                  tolerance: rule.tolerance,
                  score: score!,
                },
              ],
      };
    }),
  ];
  const eligible =
    !!f &&
    f.score !== null &&
    Number.isFinite(f.score) &&
    !!selected &&
    categories.slice(1).some((c) => c.score !== null);
  const coverage = categories.reduce((s, c) => s + c.weight * c.coverage, 0);
  const reasons = [
    ...new Set([
      ...(f?.reasons ?? []),
      ...(selected?.quality.warnings ?? []),
      'Protocole subjectif : cibles et poids de conception, sans validation scientifique de l’attractivité.',
      ...(eligible
        ? [
            'Profil assisté : fiabilité limitée. Un seul profil est utilisé; les côtés ne sont pas moyennés.',
          ]
        : [
            'Ajoutez une analyse frontale et un profil confirmé comportant au moins une mesure de score. Le score frontal reste disponible.',
          ]),
      ...(coverage < 1
        ? ['Couverture partielle; normalisation sur les entrées disponibles uniquement.']
        : []),
    ]),
  ];
  return {
    version: config.version,
    score: eligible
      ? categories.reduce((s, c) => s + (c.score ?? 0) * c.weight * c.coverage, 0) / coverage
      : null,
    coverage,
    categories: categories.map((c) => ({
      ...c,
      contribution:
        eligible && c.score !== null ? (c.score * c.weight * c.coverage) / coverage : null,
    })),
    missing: categories.filter((c) => c.coverage < 1).map((c) => c.name),
    disclaimer: DISCLAIMER,
    reliability: eligible ? 'limited' : 'unavailable',
    reasons,
    profileSourceId: eligible ? selected?.id : undefined,
  };
}
