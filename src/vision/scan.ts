import type { ScanObservation } from '../types';
export const SCAN_STAGES = [
  {
    id: 'front' as const,
    title: 'Regardez droit devant vous',
    instruction: 'Placez votre visage dans le guide. Gardez une expression neutre.',
    targetYaw: 0,
    tolerance: 10,
    required: 16,
  },
  {
    id: 'left' as const,
    title: 'Tournez légèrement à votre gauche',
    instruction: 'Une petite rotation suffit. Conservez la tête droite et stabilisez-vous.',
    targetYaw: 22,
    tolerance: 8,
    required: 8,
  },
  {
    id: 'right' as const,
    title: 'Tournez légèrement à votre droite',
    instruction: 'Tournez doucement dans l’autre sens, puis gardez la pose.',
    targetYaw: -22,
    tolerance: 8,
    required: 8,
  },
];
export interface ScanState {
  stageIndex: number;
  accepted: number;
  observations: ScanObservation[];
  complete: boolean;
  lastTimestamp: number;
  rejected: number;
}
export const initialScan = (): ScanState => ({
  stageIndex: 0,
  accepted: 0,
  observations: [],
  complete: false,
  lastTimestamp: -Infinity,
  rejected: 0,
});
export function advanceScan(state: ScanState, observation: ScanObservation): ScanState {
  if (state.complete || observation.detection.timestamp - state.lastTimestamp < 100) return state;
  const stage = SCAN_STAGES[state.stageIndex];
  const { pose } = observation.detection;
  const valid =
    observation.quality.valid &&
    pose.source === 'matrix' &&
    Math.abs(pose.yaw - stage.targetYaw) <= stage.tolerance &&
    Math.abs(pose.pitch) <= 12;
  if (!valid)
    return {
      ...state,
      lastTimestamp: observation.detection.timestamp,
      accepted: 0,
      observations: state.observations.filter((o) => o.stage !== stage.id),
      rejected: state.rejected + 1,
    };
  const accepted = state.accepted + 1;
  const done = accepted >= stage.required;
  return {
    ...state,
    accepted: done ? 0 : accepted,
    stageIndex: done ? state.stageIndex + 1 : state.stageIndex,
    observations: [...state.observations, { ...observation, stage: stage.id }],
    complete: done && state.stageIndex === SCAN_STAGES.length - 1,
    lastTimestamp: observation.detection.timestamp,
  };
}
