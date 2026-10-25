import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateProfileDataset,
  type ProfileEvaluationDataset,
} from '../../src/validation/profile-evaluation';
import type { ProfilePoint, ProfilePointId } from '../../src/types/v2';

const raw = {
  nasion: [0.5, 0.2],
  pronasale: [0.7, 0.4],
  subnasale: [0.55, 0.5],
  upperLip: [0.58, 0.55],
  lowerLip: [0.58, 0.6],
  pogonion: [0.55, 0.7],
  menton: [0.5, 0.8],
  cervical: [0.3, 0.85],
};
const points = Object.fromEntries(
  Object.entries(raw).map(([id, [x, y]]) => [id, { x, y, confirmed: true, source: 'manual' }]),
) as Record<ProfilePointId, ProfilePoint>;
function dataset(): ProfileEvaluationDataset {
  return {
    schema: 'psl-profile-evaluation-1.0.0',
    metadata: {
      name: 'Synthetic test geometry',
      source: 'test-only-generated-coordinates',
      license: 'CC0 test data',
      consent: 'No person or image; generated test coordinates',
    },
    cases: [
      {
        id: 'test',
        width: 1000,
        height: 1000,
        side: 'unknown',
        referenceType: 'synthetic-test-not-anatomical-truth',
        reference: Object.fromEntries(
          Object.entries(points).map(([id, p]) => [id, { x: p.x, y: p.y, visible: true }]),
        ),
        observations: [
          {
            id: 'a',
            kind: 'annotation',
            method: 'manual',
            detected: null,
            referenceRelation: 'independent',
            strictProfileConfirmed: true,
            points: structuredClone(points),
          },
        ],
      },
    ],
  };
}

describe('reproducible profile evaluation', () => {
  it('preserves the source image aspect ratio in normalized point errors', () => {
    const data = dataset();
    data.cases[0].width = 2000;
    data.cases[0].observations[0].points.pronasale!.x += 0.01;
    expect(evaluateProfileDataset(data).cases[0].observations[0].nme).toBeCloseTo(1 / 240);
  });
  it('measures point error in source pixels divided by reference nasion–menton length', () => {
    const data = dataset();
    data.cases[0].observations[0].points.pronasale!.x += 0.01;
    const report = evaluateProfileDataset(data);
    const observation = report.cases[0].observations[0];
    expect(observation.normalizerPixels).toBeCloseTo(600);
    expect(observation.pointErrors.pronasale).toBeCloseTo(1 / 60);
    expect(observation.nme).toBeCloseTo(1 / 480);
    expect(observation.coverage).toBe(1);
    expect(report.independentPointError.nme).toBeCloseTo(1 / 480);
    expect(observation.measurements.find((m) => m.id === 'nose-projection')!.value).toBeCloseTo(
      0.16 / 0.6,
    );
    expect(data.cases[0].observations[0].points.pronasale!.x).toBe(0.71);
  });

  it('reports absent points and reference visibility separately instead of filling values', () => {
    const data = dataset();
    delete data.cases[0].reference.cervical;
    data.cases[0].reference.upperLip = { visible: false };
    delete data.cases[0].observations[0].points.lowerLip;
    const result = evaluateProfileDataset(data).cases[0];
    expect(result.referenceVisibility).toEqual({
      visible: 6,
      occluded: 1,
      unannotated: 1,
      total: 8,
    });
    expect(result.observations[0].matchedPoints).toBe(5);
    expect(result.observations[0].coverage).toBeCloseTo(5 / 6);
    expect(result.observations[0].missingVisiblePoints).toEqual(['lowerLip']);
    expect(result.observations[0].unavailableMeasurements).toEqual(['lower-lip-offset']);
  });

  it('separates actual annotation repeatability from synthetic sensitivity', () => {
    const data = dataset();
    const repeated = structuredClone(data.cases[0].observations[0]);
    repeated.id = 'b';
    repeated.kind = 'repeat-annotation';
    repeated.points.pronasale!.x += 0.01;
    const synthetic = structuredClone(repeated);
    synthetic.id = 'synthetic';
    synthetic.kind = 'synthetic-sensitivity';
    synthetic.referenceRelation = 'synthetic-derived';
    synthetic.points.pronasale!.x += 0.1;
    data.cases[0].observations.push(repeated, synthetic);
    const report = evaluateProfileDataset(data);
    const group = report.cases[0].repeatAnnotation;
    expect(group.observations).toBe(2);
    expect(group.pairs).toBe(1);
    expect(group.meanPairwiseNme).toBeCloseTo(1 / 480);
    expect(group.measurements.find((m) => m.id === 'nose-projection')!.range).toBeCloseTo(1 / 60);
    expect(report.cases[0].syntheticSensitivity.observations).toBe(1);
    expect(report.cases[0].syntheticSensitivity.meanPairwiseNme).toBeNull();
    expect(report.independentPointError.observations).toBe(2);
  });

  it('counts automatic detection outcomes only and leaves a manual dataset detection rate unavailable', () => {
    const data = dataset();
    expect(evaluateProfileDataset(data).detection.rate).toBeNull();
    const detected = structuredClone(data.cases[0].observations[0]);
    detected.id = 'detected';
    detected.method = 'automatic';
    detected.detected = true;
    const missed = structuredClone(detected);
    missed.id = 'missed';
    missed.detected = false;
    missed.points = {};
    data.cases[0].observations.push(detected, missed);
    expect(evaluateProfileDataset(data).detection).toEqual({
      attempted: 2,
      detected: 1,
      rate: 0.5,
      manualExcluded: 1,
      syntheticExcluded: 0,
    });
  });

  it('requires provenance metadata and does not accept ambiguous manual detection or synthetic truth', () => {
    const data = dataset();
    data.metadata.consent = '';
    expect(() => evaluateProfileDataset(data)).toThrow(/consent/);
    data.metadata.consent = 'test coordinates';
    data.cases[0].observations[0].detected = true;
    expect(() => evaluateProfileDataset(data)).toThrow(/detected/);
    data.cases[0].observations[0].detected = null;
    data.cases[0].observations[0].kind = 'synthetic-sensitivity';
    expect(() => evaluateProfileDataset(data)).toThrow(/synthetic-derived/);
  });

  it('does not report missing baselines, unconfirmed points or undeclared orientation as successful measures', () => {
    const data = dataset();
    data.cases[0].reference.nasion = { visible: false };
    data.cases[0].observations[0].strictProfileConfirmed = false;
    data.cases[0].observations[0].points.upperLip!.confirmed = false;
    const observation = evaluateProfileDataset(data).cases[0].observations[0];
    expect(observation.nme).toBeNull();
    expect(observation.normalizerPixels).toBeNull();
    expect(observation.unavailableMeasurements).toHaveLength(7);
    expect(observation.invalidPoints).toEqual(['upperLip']);
  });

  it('excludes self comparisons from independent point error and has no repeatability from one placement', () => {
    const data = dataset();
    data.cases[0].observations[0].referenceRelation = 'self';
    const report = evaluateProfileDataset(data);
    expect(report.cases[0].observations[0].nme).toBe(0);
    expect(report.independentPointError.nme).toBeNull();
    expect(report.cases[0].repeatAnnotation.meanPairwiseNme).toBeNull();
    expect(report.cases[0].repeatAnnotation.measurements.every((m) => m.range === null)).toBe(true);
  });

  it('executes the documented public-fixture CLI reproducibly without claiming a detector or repeat acquisition', () => {
    const output = execFileSync(process.execPath, ['scripts/evaluate-profile.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const report = JSON.parse(output);
    expect(report.detection.rate).toBeNull();
    expect(report.independentPointError.nme).toBeNull();
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].referenceVisibility).toEqual({
      visible: 7,
      occluded: 1,
      unannotated: 0,
      total: 8,
    });
    expect(report.cases[0].observations[0].unavailableMeasurements).toHaveLength(7);
    expect(report.cases[0].syntheticSensitivity.observations).toBe(5);
    expect(report.cases[0].repeatAnnotation.meanPairwiseNme).toBeNull();
    expect(
      JSON.parse(
        execFileSync(process.execPath, ['scripts/evaluate-profile.mjs'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        }),
      ),
    ).toEqual(report);
  });

  it('imports custom JSON, writes the requested report and rejects absent provenance before reporting', () => {
    const directory = mkdtempSync(join(tmpdir(), 'psl-profile-evaluation-'));
    try {
      const input = join(directory, 'dataset.json'),
        output = join(directory, 'report.json');
      const data = dataset();
      writeFileSync(input, JSON.stringify(data));
      execFileSync(process.execPath, ['scripts/evaluate-profile.mjs', input, '--output', output], {
        cwd: process.cwd(),
      });
      expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(evaluateProfileDataset(data));
      data.metadata.license = '';
      writeFileSync(input, JSON.stringify(data));
      const failure = spawnSync(process.execPath, ['scripts/evaluate-profile.mjs', input], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(failure.status).toBe(1);
      expect(failure.stdout).toBe('');
      expect(failure.stderr).toMatch(/metadata.license/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
