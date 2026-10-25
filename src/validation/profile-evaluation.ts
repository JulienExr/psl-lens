import { analyzeProfile, PROFILE_POINTS, PROFILE_VERSION } from '../morphometry/profile';
import type { ProfilePoint, ProfilePointId } from '../types/v2';
export interface ProfileEvaluationDataset {
  schema: 'psl-profile-evaluation-1.0.0';
  metadata: { name: string; source: string; license: string; consent: string };
  notes?: string[];
  cases: {
    id: string;
    width: number;
    height: number;
    side: 'left' | 'right' | 'unknown';
    referenceType: string;
    reference: Partial<Record<ProfilePointId, { visible: boolean; x?: number; y?: number }>>;
    observations: {
      id: string;
      kind: 'annotation' | 'repeat-annotation' | 'synthetic-sensitivity';
      method: 'manual' | 'automatic';
      detected: boolean | null;
      referenceRelation: 'independent' | 'self' | 'synthetic-derived';
      strictProfileConfirmed: boolean;
      points: Partial<Record<ProfilePointId, ProfilePoint>>;
      note?: string;
    }[];
  }[];
}
type EvaluationCase = ProfileEvaluationDataset['cases'][number];
type Observation = EvaluationCase['observations'][number];
const ids = PROFILE_POINTS.map((p) => p.id);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const coordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const requireField = (condition: unknown, path: string): void => {
  if (!condition) throw new Error(`Invalid profile dataset: ${path}`);
};

function validateDataset(value: unknown): asserts value is ProfileEvaluationDataset {
  requireField(isRecord(value), 'object required');
  const data = value as Record<string, unknown>;
  requireField(data.schema === 'psl-profile-evaluation-1.0.0', 'schema');
  requireField(isRecord(data.metadata), 'metadata');
  for (const field of ['name', 'source', 'license', 'consent'])
    requireField(text((data.metadata as Record<string, unknown>)[field]), `metadata.${field}`);
  requireField(
    data.notes === undefined || (Array.isArray(data.notes) && data.notes.every(text)),
    'notes',
  );
  requireField(Array.isArray(data.cases) && data.cases.length > 0, 'cases must be nonempty');
  const caseIds = new Set<string>();
  for (const raw of data.cases as unknown[]) {
    requireField(isRecord(raw), 'case object');
    const c = raw as Record<string, unknown>;
    requireField(text(c.id) && !caseIds.has(c.id), 'unique case.id');
    caseIds.add(c.id as string);
    const prefix = `cases.${c.id}`;
    requireField(
      ['width', 'height'].every(
        (key) => typeof c[key] === 'number' && Number.isFinite(c[key]) && (c[key] as number) > 0,
      ),
      `${prefix}.dimensions`,
    );
    requireField(['left', 'right', 'unknown'].includes(c.side as string), `${prefix}.side`);
    requireField(text(c.referenceType), `${prefix}.referenceType`);
    requireField(isRecord(c.reference), `${prefix}.reference`);
    for (const [id, reference] of Object.entries(c.reference as Record<string, unknown>)) {
      requireField(
        ids.includes(id as ProfilePointId) && isRecord(reference),
        `${prefix}.reference.${id}`,
      );
      const p = reference as Record<string, unknown>;
      requireField(typeof p.visible === 'boolean', `${prefix}.reference.${id}.visible`);
      if (p.visible)
        requireField(coordinate(p.x) && coordinate(p.y), `${prefix}.reference.${id}.coordinates`);
    }
    requireField(
      Array.isArray(c.observations) && c.observations.length > 0,
      `${prefix}.observations`,
    );
    const observationIds = new Set<string>();
    for (const rawObservation of c.observations as unknown[]) {
      requireField(isRecord(rawObservation), `${prefix}.observation`);
      const o = rawObservation as Record<string, unknown>;
      requireField(text(o.id) && !observationIds.has(o.id), `${prefix}.unique observation.id`);
      observationIds.add(o.id as string);
      requireField(
        ['annotation', 'repeat-annotation', 'synthetic-sensitivity'].includes(o.kind as string),
        `${prefix}.${o.id}.kind`,
      );
      requireField(
        ['manual', 'automatic'].includes(o.method as string),
        `${prefix}.${o.id}.method`,
      );
      requireField(
        o.method === 'manual' ? o.detected === null : typeof o.detected === 'boolean',
        `${prefix}.${o.id}.detected (manual=null; automatic=boolean)`,
      );
      requireField(
        ['independent', 'self', 'synthetic-derived'].includes(o.referenceRelation as string),
        `${prefix}.${o.id}.referenceRelation`,
      );
      requireField(
        (o.kind === 'synthetic-sensitivity') === (o.referenceRelation === 'synthetic-derived'),
        `${prefix}.${o.id}.synthetic-derived relation must match synthetic-sensitivity kind`,
      );
      requireField(
        typeof o.strictProfileConfirmed === 'boolean',
        `${prefix}.${o.id}.strictProfileConfirmed`,
      );
      requireField(o.note === undefined || text(o.note), `${prefix}.${o.id}.note`);
      requireField(isRecord(o.points), `${prefix}.${o.id}.points`);
      for (const pointId of Object.keys(o.points as Record<string, unknown>))
        requireField(
          ids.includes(pointId as ProfilePointId),
          `${prefix}.${o.id}.points.${pointId}: unknown point`,
        );
    }
  }
}

function validPoint(point: ProfilePoint | undefined): point is ProfilePoint {
  return (
    isRecord(point) &&
    coordinate(point.x) &&
    coordinate(point.y) &&
    point.confirmed === true &&
    (point.source === 'manual' || point.source === 'automatic-proposal')
  );
}
const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }, c: EvaluationCase) =>
  Math.hypot((a.x - b.x) * c.width, (a.y - b.y) * c.height);

function referenceScale(c: EvaluationCase): number | null {
  const n = c.reference.nasion,
    me = c.reference.menton;
  if (!n?.visible || !me?.visible) return null;
  const scale = distance({ x: n.x!, y: n.y! }, { x: me.x!, y: me.y! }, c);
  return Number.isFinite(scale) && scale > 1e-9 ? scale : null;
}

function evaluateObservation(c: EvaluationCase, observation: Observation) {
  const normalizerPixels = referenceScale(c);
  const visible = ids.filter((id) => c.reference[id]?.visible);
  const usable: Partial<Record<ProfilePointId, ProfilePoint>> = {};
  const invalidPoints = ids.filter(
    (id) => observation.points[id] !== undefined && !validPoint(observation.points[id]),
  );
  // A declared detection failure cannot supply successful point or measurement outputs.
  if (observation.detected !== false)
    for (const id of ids)
      if (validPoint(observation.points[id])) usable[id] = { ...observation.points[id] };
  const matched = visible.filter((id) => usable[id]);
  const pointErrors: Partial<Record<ProfilePointId, number>> = {};
  if (normalizerPixels !== null)
    for (const id of matched) {
      const reference = c.reference[id]!;
      pointErrors[id] =
        distance(usable[id]!, { x: reference.x!, y: reference.y! }, c) / normalizerPixels;
    }
  const analysis = analyzeProfile({
    points: usable,
    width: c.width,
    height: c.height,
    side: c.side,
    strictProfileConfirmed: observation.strictProfileConfirmed,
    source: 'import',
  });
  return {
    id: observation.id,
    kind: observation.kind,
    method: observation.method,
    detected: observation.detected,
    referenceRelation: observation.referenceRelation,
    strictProfileConfirmed: observation.strictProfileConfirmed,
    note: observation.note ?? null,
    normalizerPixels,
    pointErrors,
    nme: average(Object.values(pointErrors)),
    matchedPoints: matched.length,
    visibleReferencePoints: visible.length,
    coverage: visible.length ? matched.length / visible.length : null,
    missingVisiblePoints: visible.filter((id) => !usable[id]),
    invalidPoints,
    geometryAvailable: analysis.quality.valid,
    measurements: analysis.measurements.map(({ id, value, unit, reason }) => ({
      id,
      value,
      unit,
      reason: reason ?? null,
    })),
    unavailableMeasurements: analysis.measurements.filter((m) => m.value === null).map((m) => m.id),
    warnings: analysis.quality.warnings,
  };
}

type EvaluatedObservation = ReturnType<typeof evaluateObservation>;
function placementDispersion(c: EvaluationCase, observations: EvaluatedObservation[]) {
  const scale = referenceScale(c),
    errors: number[] = [];
  let pairs = 0;
  if (scale !== null)
    for (let a = 0; a < observations.length; a++)
      for (let b = a + 1; b < observations.length; b++) {
        const from = c.observations.find((o) => o.id === observations[a].id)!;
        const to = c.observations.find((o) => o.id === observations[b].id)!;
        if (from.detected === false || to.detected === false) continue;
        let common = 0;
        for (const id of ids) {
          if (
            !c.reference[id]?.visible ||
            !validPoint(from.points[id]) ||
            !validPoint(to.points[id])
          )
            continue;
          errors.push(distance(from.points[id]!, to.points[id]!, c) / scale);
          common++;
        }
        if (common) pairs++;
      }
  // Each range/SD has its own availability count. A single observation has no spread.
  const measurementIds = observations[0]?.measurements.map((m) => m.id) ?? [];
  return {
    observations: observations.length,
    possiblePairs:
      observations.length > 1 ? (observations.length * (observations.length - 1)) / 2 : 0,
    pairs,
    comparedPointPairs: errors.length,
    meanPairwiseNme: average(errors),
    measurements: measurementIds.map((id) => {
      const available = observations.flatMap((o) => {
        const value = o.measurements.find((m) => m.id === id)?.value;
        return value !== undefined && value !== null ? [value] : [];
      });
      const mean = average(available);
      return {
        id,
        samples: available.length,
        mean,
        range: available.length > 1 ? Math.max(...available) - Math.min(...available) : null,
        sampleSd:
          available.length > 1 && mean !== null
            ? Math.sqrt(
                available.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
                  (available.length - 1),
              )
            : null,
      };
    }),
  };
}

/** Evaluate declared annotations, not images. Metadata is checked before any calculation.
 * The evaluator never infers consent, expert reference quality or a strict 90° pose.
 */
export function evaluateProfileDataset(dataset: unknown) {
  validateDataset(dataset);
  const cases = dataset.cases.map((c) => {
    const observations = c.observations.map((o) => evaluateObservation(c, o));
    return {
      id: c.id,
      width: c.width,
      height: c.height,
      side: c.side,
      referenceType: c.referenceType,
      referenceVisibility: {
        visible: ids.filter((id) => c.reference[id]?.visible === true).length,
        occluded: ids.filter((id) => c.reference[id]?.visible === false).length,
        unannotated: ids.filter((id) => c.reference[id] === undefined).length,
        total: ids.length,
      },
      observations,
      repeatAnnotation: placementDispersion(
        c,
        observations.filter((o) => o.kind !== 'synthetic-sensitivity'),
      ),
      syntheticSensitivity: placementDispersion(
        c,
        observations.filter((o) => o.kind === 'synthetic-sensitivity'),
      ),
    };
  });
  const all = cases.flatMap((c) => c.observations);
  const real = all.filter((o) => o.kind !== 'synthetic-sensitivity');
  const automatic = real.filter((o) => o.method === 'automatic');
  const independent = real.filter((o) => o.referenceRelation === 'independent');
  const errors = independent.flatMap((o) => Object.values(o.pointErrors));
  const visibleCount = independent.reduce((n, o) => n + o.visibleReferencePoints, 0);
  return {
    schema: 'psl-profile-evaluation-report-1.0.0',
    algorithm: PROFILE_VERSION,
    metadata: { ...dataset.metadata },
    notes: dataset.notes ?? [],
    conventions: {
      coordinates: 'normalized source-image x/y; distance in source pixels',
      normalizer: 'reference nasion–menton pixel distance',
      nme: 'sum of matched visible point errors / matched point count / reference scale',
      coverage:
        'matched visible reference points / visible reference points; missing points never imputed',
      detection: 'declared automatic outcomes only; evaluator does not run a detector',
      repeatability: 'pairwise same-image placement dispersion, not repeat acquisition or an ICC',
      sensitivity: 'synthetic perturbations reported separately from observed annotations',
    },
    detection: {
      attempted: automatic.length,
      detected: automatic.filter((o) => o.detected).length,
      rate: automatic.length ? automatic.filter((o) => o.detected).length / automatic.length : null,
      manualExcluded: real.filter((o) => o.method === 'manual').length,
      syntheticExcluded: all.length - real.length,
    },
    independentPointError: {
      observations: independent.length,
      matchedPoints: independent.reduce((n, o) => n + o.matchedPoints, 0),
      visibleReferencePoints: visibleCount,
      coverage: visibleCount
        ? independent.reduce((n, o) => n + o.matchedPoints, 0) / visibleCount
        : null,
      nme: average(errors),
    },
    cases,
  };
}
