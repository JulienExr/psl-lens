import type { AggregatedAnalysis } from '../types';
import type { ProfileAnalysis, ViewAssociation } from '../types/v2';
/** Called only by an explicit user action. No identity inference or persistence. */
export function confirmViewAssociation(
  frontal: AggregatedAnalysis | null,
  profiles: ProfileAnalysis[],
): ViewAssociation | null {
  if (!frontal || !profiles.length || new Set(profiles.map((p) => p.id)).size !== profiles.length)
    return null;
  return {
    frontalId: frontal.id,
    profileIds: profiles.map((p) => p.id).sort(),
    confirmedAt: new Date().toISOString(),
  };
}
export function isViewAssociationConfirmed(
  frontal: AggregatedAnalysis | null,
  profiles: ProfileAnalysis[],
  association: ViewAssociation | null | undefined,
): boolean {
  if (
    !frontal ||
    !profiles.length ||
    !association ||
    association.frontalId !== frontal.id ||
    !Number.isFinite(Date.parse(association.confirmedAt))
  )
    return false;
  const actual = profiles.map((p) => p.id).sort(),
    confirmed = [...association.profileIds].sort();
  return (
    new Set(actual).size === actual.length &&
    actual.length === confirmed.length &&
    actual.every((id, i) => id === confirmed[i])
  );
}
