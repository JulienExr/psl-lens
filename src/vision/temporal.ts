import type { AggregatedAnalysis, ScanObservation } from '../types';
import { robustSummary } from '../morphometry/geometry';
import { score } from '../scoring';
export function aggregate(
  observations: ScanObservation[],
  source: AggregatedAnalysis['source'],
  rejectedCount = 0,
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
      .filter((v): v is number => typeof v === 'number');
    const summary = robustSummary(values);
    if (!summary) return { ...m, value: null, confidence: 'unavailable' as const, samples: 0 };
    return {
      ...m,
      value: summary.value,
      spread: summary.spread,
      samples: summary.samples,
      confidence:
        summary.samples < 5 || summary.spread > Math.max(Math.abs(summary.value) * 0.1, 0.01)
          ? ('low' as const)
          : ('moderate' as const),
    };
  });
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    measurements,
    score: score(measurements),
    observationCount: valid.length,
    morphometryCount: front.length,
    rejectedCount: rejectedCount + observations.length - valid.length,
    quality: representative.quality,
    representative: representative.detection,
  };
}
