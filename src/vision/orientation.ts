import type { FacePose } from '../types';
import type { ViewKind } from '../types/v2';
/** Capture provenance, separate from the frontal formula protocol and acquisition stage. */
export function classifyObservedView(pose: FacePose): ViewKind {
  if (pose.source !== 'matrix' || ![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite))
    return 'orientation-unknown';
  if (pose.yaw > 8) return 'oblique-left';
  if (pose.yaw < -8) return 'oblique-right';
  return Math.abs(pose.pitch) > 8 ? 'non-frontal' : 'front';
}
export function orientationWarning(views: ViewKind[]): string | undefined {
  if (views.every((v) => v === 'front')) return undefined;
  if (views.length > 1)
    return 'Estimation indicative sur plusieurs orientations observées; aucune acquisition frontale stabilisée ne doit en être déduite.';
  if (views[0] === 'orientation-unknown')
    return 'Orientation inconnue : estimation indicative; aucune acquisition frontale stabilisée n’est validée.';
  return 'Estimation sur vue oblique ou inclinée : orientation observée conservée; aucune acquisition frontale stabilisée n’est validée.';
}
