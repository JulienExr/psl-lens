import type { ScanConsistency, ScanMode, ScanObservation } from '../types';
import { distance, median } from '../morphometry/geometry';
export const SCAN_STAGES = [
  {
    id: 'front' as const,
    title: 'Regardez droit devant vous',
    instruction: 'Placez votre visage dans le guide. Gardez une expression neutre.',
    targetYaw: 0,
    tolerance: 8,
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
  mode: ScanMode;
  stageIndex: number;
  accepted: number;
  observations: ScanObservation[];
  complete: boolean;
  lastTimestamp: number;
  rejected: number;
}
export const getScanStages = (mode: ScanMode) =>
  mode === 'quick' ? SCAN_STAGES.slice(0, 1) : SCAN_STAGES;
export const initialScan = (mode: ScanMode = 'quick'): ScanState => ({
  mode,
  stageIndex: 0,
  accepted: 0,
  observations: [],
  complete: false,
  lastTimestamp: -Infinity,
  rejected: 0,
});
export function advanceScan(state: ScanState, observation: ScanObservation): ScanState {
  if (
    state.complete ||
    !Number.isFinite(observation.detection.timestamp) ||
    observation.detection.timestamp - state.lastTimestamp < 100
  )
    return state;
  const stages = getScanStages(state.mode);
  const stage = stages[state.stageIndex];
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
    complete: done && state.stageIndex === stages.length - 1,
    lastTimestamp: observation.detection.timestamp,
  };
}

export function assessScanConsistency(observations: ScanObservation[]): ScanConsistency {
  const groups = SCAN_STAGES.map((stage) =>
    observations.filter(
      (o) => o.stage === stage.id && o.quality.valid && o.detection.faces.length === 1,
    ),
  );
  if (groups.some((g, i) => g.length < SCAN_STAGES[i].required))
    return {
      status: 'not-checked',
      issues: ['Vues supplémentaires absentes ou incomplètes : aucune validation multi-angle.'],
      checks: [],
    };
  const descriptor = (o: ScanObservation) => {
    const { width, height, faces } = o.detection;
    const p = (i: number) => ({ x: faces[0][i]?.x * width, y: faces[0][i]?.y * height });
    const size = distance(p(10), p(152));
    return {
      size,
      lower: distance(p(2), p(152)) / size,
      center: { x: (p(10).x + p(152).x) / 2, y: (p(10).y + p(152).y) / 2 },
    };
  };
  const summarize = (g: ScanObservation[]) => {
    const data = g.map(descriptor);
    return {
      size: median(data.map((d) => d.size)),
      lower: median(data.map((d) => d.lower)),
      center: { x: median(data.map((d) => d.center.x)), y: median(data.map((d) => d.center.y)) },
    };
  };
  const front = summarize(groups[0]);
  const issues: string[] = [];
  const checks = groups.slice(1).map((group, i) => {
    const stage = SCAN_STAGES[i + 1];
    const current = summarize(group);
    const sizeRatio = current.size / front.size,
      lowerFaceRatio = current.lower / front.lower,
      centerShift = distance(current.center, front.center) / front.size;
    const sameFrame = group.every(
      (o) =>
        o.detection.width === groups[0][0].detection.width &&
        o.detection.height === groups[0][0].detection.height,
    );
    const correctPose = group.every(
      (o) =>
        o.detection.pose.source === 'matrix' &&
        Number.isFinite(o.detection.pose.yaw) &&
        Math.abs(o.detection.pose.yaw - stage.targetYaw) <= stage.tolerance &&
        Math.abs(o.detection.pose.pitch) <= 12,
    );
    const passed =
      sameFrame &&
      correctPose &&
      [sizeRatio, lowerFaceRatio, centerShift].every(Number.isFinite) &&
      sizeRatio >= 0.75 &&
      sizeRatio <= 1.3 &&
      lowerFaceRatio >= 0.7 &&
      lowerFaceRatio <= 1.3 &&
      centerShift <= 0.35;
    if (!passed)
      issues.push(
        `Vue ${stage.id === 'left' ? 'gauche' : 'droite'} incohérente : changement excessif de taille, cadrage, pose ou géométrie apparente.`,
      );
    return { stage: stage.id as 'left' | 'right', sizeRatio, lowerFaceRatio, centerShift, passed };
  });
  return { status: issues.length ? 'inconsistent' : 'consistent', issues, checks };
}

/** Restart only the selected real acquisition stage, preserving completed earlier views. */
export function restartScanStage(state: ScanState): ScanState {
  const stages = getScanStages(state.mode);
  const index = Math.min(state.stageIndex, stages.length - 1);
  const retained = new Set(stages.slice(0, index).map((s) => s.id));
  return {
    ...state,
    stageIndex: index,
    accepted: 0,
    complete: false,
    lastTimestamp: -Infinity,
    observations: state.observations.filter((o) => retained.has(o.stage)),
  };
}
