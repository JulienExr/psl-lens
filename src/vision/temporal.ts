import type { AggregatedAnalysis, Measurement, ScanMode, ScanObservation } from '../types';
import { median, robustSummary } from '../morphometry/geometry';
import { score } from '../scoring';
import { scoreFrontal } from '../scoring/frontal';
import { classifyObservedView, orientationWarning } from './orientation';
import { assessScanConsistency } from './scan';
export function aggregate(
  observations: ScanObservation[],
  source: AggregatedAnalysis['source'],
  rejectedCount = 0,
  options: { scanMode?: ScanMode; captureIssues?: string[] } = {},
): AggregatedAnalysis {
  const valid = observations.filter(
    (o) => (source !== 'guided' || o.quality.valid) && o.detection.faces.length === 1,
  );
  const front = valid.filter(
    (o) =>
      (source !== 'guided' || o.quality.frontal) &&
      o.measurements.some((m) => m.value !== null && Number.isFinite(m.value)),
  );
  if (!front.length)
    throw new Error('Aucun visage mesurable. Reprenez une capture avec un seul visage visible.');
  const representative = front[Math.floor(front.length / 2)];
  const observedViews = [...new Set(front.map((o) => classifyObservedView(o.detection.pose)))];
  const provenanceWarning = orientationWarning(observedViews);
  const validatedFrontal =
    source === 'guided' &&
    front.length >= 16 &&
    observedViews.length === 1 &&
    observedViews[0] === 'front' &&
    front.every((o) => o.stage === 'front' && o.quality.valid && o.quality.frontal);
  const measurements = representative.measurements.map((m) => {
    const values = front
      .map((o) => o.measurements.find((v) => v.id === m.id)?.value)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const summary = robustSummary(values);
    if (!summary) return { ...m, value: null, confidence: 'unavailable' as const, samples: 0 };
    const single = source === 'photo' && front.length === 1;
    const rawSpread =
      values.length > 1
        ? 1.4826 * median(values.map((v) => Math.abs(v - median(values))))
        : undefined;
    const retention = summary.samples / front.length;
    const limit = Math.max(Math.abs(summary.value) * 0.1, m.unit === '°' ? 0.75 : 0.01);
    const reliabilityReason: Measurement['reliabilityReason'] = single
      ? 'single-photo'
      : front.some((o) => !o.quality.valid || !o.quality.frontal)
        ? 'capture-quality'
        : summary.samples < 5
          ? 'insufficient-samples'
          : retention < 0.75
            ? 'outliers'
            : summary.spread > limit || (rawSpread ?? Infinity) > limit
              ? 'dispersion'
              : undefined;
    return {
      ...m,
      value: summary.value,
      spread: values.length > 1 ? summary.spread : undefined,
      rawSpread,
      retention,
      reliabilityReason,
      samples: summary.samples,
      provenance: {
        view: observedViews.length === 1 ? observedViews[0] : ('mixed-orientations' as const),
        observedViews,
        validatedFrontal,
        method: 'automatic' as const,
        algorithm: 'frontal-1.1.0',
        source,
        observations: summary.samples,
        orientation: representative.detection.pose,
      },
      confidence: reliabilityReason ? ('low' as const) : ('moderate' as const),
    };
  });
  const frontalScore = scoreFrontal(measurements, {
    source,
    quality: representative.quality,
    pose: representative.detection.pose,
  });
  if (provenanceWarning) {
    if (frontalScore.score !== null) frontalScore.reliability = 'limited';
    frontalScore.reasons.push(provenanceWarning);
  }
  if (
    front.some((o) => Math.abs(o.detection.pose.yaw) > 8 || Math.abs(o.detection.pose.pitch) > 8)
  ) {
    if (frontalScore.score !== null) frontalScore.reliability = 'limited';
    frontalScore.reasons.push(
      'La pose dépasse la plage recommandée (±8°) sur certaines observations : estimation indicative.',
    );
  }
  const scan =
    source === 'guided'
      ? {
          mode: options.scanMode ?? ('quick' as ScanMode),
          consistency: assessScanConsistency(observations),
        }
      : undefined;
  if (scan?.mode === 'multi-angle' && scan.consistency.status !== 'consistent') {
    if (frontalScore.score !== null) frontalScore.reliability = 'limited';
    frontalScore.reasons.push(
      'Acquisition multi-angle incohérente ou incomplète : le score reste une estimation frontale indicative. Recommencez pour affiner.',
    );
  }
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    measurements,
    views: [...new Set(valid.map((o) => classifyObservedView(o.detection.pose)))].map((view) => {
      const group = valid.filter((o) => classifyObservedView(o.detection.pose) === view);
      const o = group[Math.floor(group.length / 2)];
      const checked =
        source === 'guided' &&
        view === 'front' &&
        group.length >= 16 &&
        group.every((o) => o.stage === 'front' && o.quality.valid && o.quality.frontal);
      const warning = orientationWarning([view]);
      return {
        id: `${view}-${o.detection.timestamp}`,
        view,
        method: 'automatic' as const,
        source,
        observationCount: group.length,
        validatedFrontal: checked,
        pose: o.detection.pose,
        quality: checked
          ? 'acquisition frontale stabilisée'
          : view !== 'front'
            ? 'indicative · orientation non frontale ou inconnue'
            : group.every((o) => o.quality.valid)
              ? 'exploitable · non stabilisée'
              : 'à améliorer',
        warnings: [
          ...new Set([...group.flatMap((o) => o.quality.issues), ...(warning ? [warning] : [])]),
        ],
        algorithm: group.some((o) => o.stage === 'front') ? 'frontal-1.1.0' : 'continuity-1.1.0',
      };
    }),
    score: score(measurements),
    frontalScore,
    scan,
    captureIssues: [
      ...new Set([
        ...(options.captureIssues ?? []),
        ...(provenanceWarning ? [provenanceWarning] : []),
        ...observations.flatMap((o) => o.quality.issues),
      ]),
    ],
    observationCount: valid.length,
    morphometryCount: front.length,
    rejectedCount: rejectedCount + observations.length - valid.length,
    quality: representative.quality,
    representative: representative.detection,
  };
}
