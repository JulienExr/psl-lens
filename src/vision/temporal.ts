import type { AggregatedAnalysis, Measurement, ScanMode, ScanObservation } from '../types';
import { median, robustSummary } from '../morphometry/geometry';
import { score } from '../scoring';
import { scoreFrontal } from '../scoring/frontal';
import { assessScanConsistency } from './scan';
export function aggregate(
  observations: ScanObservation[],
  source: AggregatedAnalysis['source'],
  rejectedCount = 0,
  options: { scanMode?: ScanMode; captureIssues?: string[] } = {},
): AggregatedAnalysis {
  const valid = observations.filter((o) => o.quality.valid && o.detection.faces.length === 1);
  const front = valid.filter(
    (o) => o.quality.frontal && o.measurements.some((m) => m.value !== null),
  );
  if (!front.length) throw new Error('Aucune observation frontale exploitable.');
  const representative = front[Math.floor(front.length / 2)];
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
      confidence: reliabilityReason ? ('low' as const) : ('moderate' as const),
    };
  });
  const frontalScore = scoreFrontal(measurements, {
    source,
    quality: representative.quality,
    pose: representative.detection.pose,
  });
  if (
    front.some((o) => Math.abs(o.detection.pose.yaw) > 8 || Math.abs(o.detection.pose.pitch) > 8)
  ) {
    frontalScore.score = null;
    frontalScore.reliability = 'unavailable';
    frontalScore.reasons.push(
      'Certaines observations dépassent la pose du protocole frontal (±8°).',
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
    frontalScore.score = null;
    frontalScore.reliability = 'unavailable';
    frontalScore.reasons.push(
      'Acquisition multi-angle incohérente ou incomplète. Recommencez ou choisissez le Quick Scan.',
    );
  }
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    measurements,
    score: score(measurements),
    frontalScore,
    scan,
    captureIssues: [
      ...new Set([
        ...(options.captureIssues ?? []),
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
