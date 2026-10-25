import type { ScanObservation } from '../types';
import type { ScanState } from './scan';
import { aggregate } from './temporal';
/** Preserve accepted orientation stages when handing an unfinished Advanced Scan to Profile. */
export function buildAdvancedContinuation(
  state: ScanState,
  approximate: ScanObservation[],
  captureIssues: string[],
) {
  const front = state.observations.filter(
    (o) =>
      o.stage === 'front' &&
      o.quality.valid &&
      o.quality.frontal &&
      o.measurements.some((m) => m.value !== null && Number.isFinite(m.value)),
  );
  if (front.length >= 16)
    return aggregate(state.observations, 'guided', state.rejected, {
      scanMode: state.mode,
      captureIssues: [
        ...captureIssues,
        ...(!state.complete
          ? ['Acquisition automatique partielle : certaines vues restent à compléter.']
          : []),
      ],
    });
  if (front.length)
    return aggregate(front, 'live', state.rejected, {
      captureIssues: [
        ...captureIssues,
        `Étape frontale partielle (${front.length}/16); aucune vue oblique combinée.`,
      ],
    });
  const last = [...approximate]
    .reverse()
    .find((o) => o.measurements.some((m) => m.value !== null && Number.isFinite(m.value)));
  return last
    ? aggregate([last], 'live', state.rejected, {
        captureIssues: [
          ...captureIssues,
          'Aucune étape frontale stabilisée : dernière observation seule, indicative, sans moyenne entre orientations.',
        ],
      })
    : undefined;
}
