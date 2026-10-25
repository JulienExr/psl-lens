import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, recommendV2 } from '../../src/recommendations/v2';
import type { AggregatedAnalysis } from '../../src/types';
import type { ProfileAnalysis, StylePreferences } from '../../src/types/v2';
import { aggregate } from '../../src/vision/temporal';
import { measure } from '../../src/morphometry/metrics';
import { fixtureDetection, readyQuality } from '../fixtures/face';

function frontal(): AggregatedAnalysis {
  const detection = fixtureDetection();
  return aggregate(
    Array.from({ length: 6 }, () => ({
      detection,
      quality: readyQuality,
      measurements: measure(detection, readyQuality),
      stage: 'front' as const,
    })),
    'guided',
  );
}

function profile(): ProfileAnalysis {
  return {
    id: 'profile-a',
    createdAt: '2026-10-24T12:00:00Z',
    side: 'left',
    facing: 'image-left',
    width: 640,
    height: 640,
    points: {},
    measurements: [],
    quality: { valid: false, warnings: ['Repères à confirmer.'], completeness: 0.5 },
    method: 'assisted',
    algorithm: 'profile-2d-2.0.0',
    source: 'import',
    orientation: { method: 'user-declared', strictProfileConfirmed: false },
  };
}

describe('deterministic V2 capture recommendations', () => {
  it('does not fabricate capture issues or opt into presentation on empty or ready input', () => {
    expect(recommendV2(null, [], DEFAULT_PREFERENCES)).toEqual([]);
    expect(recommendV2(frontal(), [], DEFAULT_PREFERENCES)).toEqual([]);
  });

  it.each([
    ['brightness', 44, 'capture-light-low'],
    ['brightness', 226, 'capture-light-high'],
    ['sharpness', 11, 'capture-sharpness'],
    ['faceSize', 0.2, 'capture-framing-small'],
    ['faceSize', 0.85, 'capture-framing-tight'],
    ['stability', 1.1, 'capture-stability'],
  ] as const)('grounds %s=%s in measured evidence', (field, value, id) => {
    const analysis = frontal();
    analysis.quality = { ...readyQuality, [field]: value };
    const advice = recommendV2(analysis, [], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual([id]);
    expect(advice[0].evidence.join(' ')).toContain(String(value));
    expect(advice[0]).toMatchObject({
      kind: 'capture',
      objective: expect.any(String),
      rationale: expect.any(String),
      limits: expect.any(String),
    });
  });

  it('does not turn unmeasured or non-finite quality into a lighting or blur diagnosis', () => {
    const analysis = frontal();
    analysis.quality = { ...readyQuality, brightness: null, sharpness: NaN, stability: Infinity };
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES)).toEqual([]);
  });

  it('does not flag accepted threshold boundaries', () => {
    const analysis = frontal();
    analysis.quality = {
      ...readyQuality,
      brightness: 45,
      sharpness: 12,
      faceSize: 0.28,
      stability: 1,
    };
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES)).toEqual([]);
  });

  it('uses measured pose and distinguishes unavailable orientation from rotation', () => {
    const analysis = frontal();
    analysis.representative.pose = { yaw: 16, pitch: 0, roll: 0, source: 'matrix' };
    const advice = recommendV2(analysis, [], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual(['capture-pose']);
    expect(advice[0].evidence.join(' ')).toContain('16');
    analysis.representative.pose.source = 'unavailable';
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES).map((r) => r.id)).toEqual([
      'capture-pose-unverified',
    ]);
  });

  it('retains actual scan issues even when the representative frame is ready', () => {
    const analysis = frontal();
    analysis.captureIssues = ['Image trop floue : stabilisez la caméra.'];
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES).map((r) => r.id)).toEqual([
      'capture-sharpness',
    ]);
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES)[0].evidence).toContain(
      analysis.captureIssues[0],
    );
  });

  it('does not interpret unverified pixel quality as evidence of low light', () => {
    const analysis = frontal();
    analysis.captureIssues = ['Qualité lumineuse et netteté non vérifiées.'];
    expect(recommendV2(analysis, [], DEFAULT_PREFERENCES).map((r) => r.id)).toEqual([
      'capture-quality-unverified',
    ]);
  });

  it('retains explicit rotation problems from earlier scan observations', () => {
    const analysis = frontal();
    analysis.captureIssues = ['Redressez la tête et limitez la rotation.'];
    const advice = recommendV2(analysis, [], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual(['capture-pose']);
    expect(advice[0].evidence).toContain(analysis.captureIssues[0]);
  });

  it.each([
    ['Gardez une expression neutre et les yeux ouverts.', 'capture-expression'],
    ['Gardez un seul visage dans le cadre.', 'capture-detection'],
  ])('retains the observed issue %s', (issue, id) => {
    const analysis = frontal();
    analysis.captureIssues = [issue];
    const advice = recommendV2(analysis, [], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual([id]);
    expect(advice[0].evidence).toContain(issue);
  });

  it('explains limited repetition and an inconsistent scan without invented image defects', () => {
    const analysis = frontal();
    analysis.morphometryCount = 1;
    analysis.scan = {
      mode: 'multi-angle',
      consistency: { status: 'inconsistent', issues: ['Distance variable.'], checks: [] },
    };
    const advice = recommendV2(analysis, [], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual(['capture-repeatability', 'capture-consistency']);
    expect(advice[1].evidence).toContain('Distance variable.');
  });

  it('uses profile validation state without treating manual uncertainty as a defect', () => {
    const input = profile();
    const advice = recommendV2(null, [input], DEFAULT_PREFERENCES);
    expect(advice.map((r) => r.id)).toEqual(['capture-profile-profile-a']);
    expect(advice[0].evidence).toContain('Repères à confirmer.');
    input.quality.valid = true;
    input.orientation.strictProfileConfirmed = true;
    expect(recommendV2(null, [input], DEFAULT_PREFERENCES)).toEqual([]);
  });
});

describe('declared presentation preferences', () => {
  it('requires a declared length or beard choice after opting into their topics', () => {
    expect(recommendV2(null, [], { ...DEFAULT_PREFERENCES, topics: ['hair', 'beard'] })).toEqual(
      [],
    );
    const preferences: StylePreferences = {
      hairLength: 'long',
      beard: 'without',
      style: 'creative',
      topics: ['hair', 'beard', 'photo'],
    };
    const result = recommendV2(null, [], preferences);
    expect(result.map((r) => r.id)).toEqual([
      'presentation-hair',
      'presentation-beard',
      'presentation-photo',
    ]);
    expect(result[0].evidence.join(' ')).toMatch(/longs/i);
    expect(result[1].objective).toMatch(/sans barbe/i);
    expect(
      result.every(
        (r) =>
          r.kind === 'presentation' &&
          r.evidence.length > 0 &&
          r.objective &&
          r.rationale &&
          r.limits,
      ),
    ).toBe(true);
  });

  it('changes exploration with declared style and never uses face geometry to infer taste', () => {
    const prefs: StylePreferences = {
      ...DEFAULT_PREFERENCES,
      hairLength: 'short',
      topics: ['hair'],
      style: 'classic',
    };
    const classic = recommendV2(frontal(), [], prefs);
    const creative = recommendV2(frontal(), [], { ...prefs, style: 'creative' });
    expect(classic[0].objective).not.toEqual(creative[0].objective);
    const changedFace = frontal();
    changedFace.measurements = [
      { id: 'face-ratio', value: 12 } as AggregatedAnalysis['measurements'][number],
    ];
    expect(recommendV2(changedFace, [], prefs)).toEqual(classic);
  });

  it('is deterministic, deduplicates topics and leaves every input untouched', () => {
    const analysis = frontal();
    const profiles = [profile()];
    const prefs: StylePreferences = { ...DEFAULT_PREFERENCES, topics: ['photo', 'photo'] };
    const before = JSON.stringify({ analysis, profiles, prefs });
    const result = recommendV2(analysis, profiles, prefs);
    expect(recommendV2(analysis, profiles, prefs)).toEqual(result);
    expect(result.filter((r) => r.id === 'presentation-photo')).toHaveLength(1);
    expect(JSON.stringify({ analysis, profiles, prefs })).toEqual(before);
  });
});
