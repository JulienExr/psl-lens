import type { AggregatedAnalysis } from '../types';
import type { ProfileAnalysis, Recommendation, ReportData, ViewSummary } from '../types/v2';
import { scoreMultiview } from '../scoring/multiview';
export function buildReportData(
  frontal: AggregatedAnalysis | null,
  profiles: ProfileAnalysis[],
  recommendations: Recommendation[] = [],
): ReportData {
  const views: ViewSummary[] = [
    ...(frontal?.views ??
      (frontal
        ? [
            {
              id: frontal.id,
              view: 'front' as const,
              method: 'automatic' as const,
              source: frontal.source,
              observationCount: frontal.morphometryCount,
              pose: frontal.representative.pose,
              quality: frontal.quality.valid ? 'exploitable' : 'à améliorer',
              warnings: frontal.captureIssues ?? [],
              algorithm: 'frontal-1.1.0',
            },
          ]
        : [])),
    ...profiles.map((p) => ({
      id: p.id,
      view: `profile-${p.side}` as ViewSummary['view'],
      method: p.method,
      source: p.source,
      observationCount: 1,
      quality: 'limitée · placement manuel',
      warnings: p.quality.warnings,
      algorithm: p.algorithm,
    })),
  ];
  return {
    frontal,
    profiles,
    multiview: scoreMultiview(frontal, profiles),
    views,
    recommendations,
  };
}
export function exportReportData(data: ReportData, includeScores: boolean) {
  return {
    schema: 'psl-report-2.0.0',
    createdAt: data.frontal?.createdAt ?? data.profiles[0]?.createdAt,
    source: data.frontal?.source ?? 'profile',
    observationCount: data.frontal?.observationCount ?? 1,
    measurements: data.frontal?.measurements ?? [],
    profiles: data.profiles.map(({ preview: _preview, points: _points, ...p }) => {
      void _preview;
      void _points;
      return p;
    }),
    views: data.views,
    scan: data.frontal?.scan,
    recommendations: data.recommendations,
    ...(includeScores
      ? {
          score: data.frontal?.score,
          frontalScore: data.frontal?.frontalScore,
          multiviewScore: data.multiview,
        }
      : {}),
    limitations: [
      'Projections 2D apparentes sans calibration physique.',
      'Profil assisté; exactitude anatomique non validée.',
    ],
    disclaimer: data.multiview.disclaimer,
  };
}
