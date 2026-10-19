import { describe, it, expect } from 'vitest';
import { assessQuality, pixelQuality, poseFromMatrix } from '../../src/vision/quality';
import { advanceScan, initialScan, SCAN_STAGES } from '../../src/vision/scan';
import { aggregate } from '../../src/vision/temporal';
import { measure } from '../../src/morphometry/metrics';
import { fixtureDetection, readyQuality } from '../fixtures/face';
const pixels = { brightness: 130, sharpness: 80 };
describe('quality gates', () => {
  it('accepts a centered neutral face and rejects absent/multiple faces', () => {
    expect(assessQuality(fixtureDetection(), pixels).valid).toBe(true);
    expect(assessQuality({ ...fixtureDetection(), faces: [] }, pixels).valid).toBe(false);
    const two = fixtureDetection();
    two.faces.push(two.faces[0]);
    expect(assessQuality(two, pixels).issues.join(' ')).toContain('seul visage');
  });
  it('rejects poor illumination, blur, motion and non-neutral expression', () => {
    expect(assessQuality(fixtureDetection(), { brightness: 10, sharpness: 80 }).valid).toBe(false);
    expect(assessQuality(fixtureDetection(), { brightness: 130, sharpness: 0 }).valid).toBe(false);
    const moved = fixtureDetection(15, 200);
    expect(assessQuality(moved, pixels, fixtureDetection()).valid).toBe(false);
    expect(
      assessQuality({ ...fixtureDetection(), blendshapes: { jawOpen: 0.9 } }, pixels).valid,
    ).toBe(false);
  });
  it('marks unknown pose and unknown image quality as invalid', () => {
    expect(
      assessQuality(
        { ...fixtureDetection(), pose: { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' } },
        pixels,
      ).valid,
    ).toBe(false);
    expect(assessQuality(fixtureDetection(), null).valid).toBe(false);
  });
  it('derives approximate Euler angles from a column-major identity matrix', () => {
    expect(poseFromMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])).toMatchObject({
      yaw: 0,
      pitch: 0,
      roll: 0,
      source: 'matrix',
    });
    expect(poseFromMatrix([]).source).toBe('unavailable');
  });
  it('measures actual pixels without returning a model confidence', () => {
    expect(pixelQuality(new Uint8ClampedArray(8 * 8 * 4).fill(128), 8, 8).brightness).toBe(128);
    expect(pixelQuality(new Uint8ClampedArray(8 * 8 * 4).fill(128), 8, 8).sharpness).toBe(0);
  });
});
describe('guided scan', () => {
  it('uses positive column-major Y rotation for anatomical left, negative for right', () => {
    const theta = (22 * Math.PI) / 180;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const leftPose = poseFromMatrix([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
    expect(leftPose.yaw).toBeCloseTo(22);
    const left = SCAN_STAGES.find((s) => s.id === 'left')!;
    expect(left.targetYaw).toBeCloseTo(leftPose.yaw);
    expect(SCAN_STAGES.find((s) => s.id === 'right')!.targetYaw).toBe(-22);
  });
  it('never progresses with invalid quality, repeated frames or wrong pose', () => {
    let state = initialScan();
    for (let i = 0; i < 40; i++)
      state = advanceScan(state, {
        detection: fixtureDetection(0, i * 200),
        quality: { ...readyQuality, valid: false },
        measurements: [],
        stage: 'front',
      });
    expect(state.stageIndex).toBe(0);
    expect(state.accepted).toBe(0);
    const obs = {
      detection: fixtureDetection(0, 200),
      quality: readyQuality,
      measurements: [],
      stage: 'front' as const,
    };
    state = advanceScan(initialScan(), obs);
    const repeated = advanceScan(state, obs);
    expect(repeated.accepted).toBe(1);
  });
  it('completes only with sufficient valid observations at all target poses', () => {
    let state = initialScan();
    let t = 0;
    for (const stage of SCAN_STAGES) {
      for (let n = 0; n < stage.required; n++) {
        t += 200;
        state = advanceScan(state, {
          detection: fixtureDetection(stage.targetYaw, t),
          quality: readyQuality,
          measurements: measure(fixtureDetection(), readyQuality),
          stage: stage.id,
        });
      }
    }
    expect(state.complete).toBe(true);
    expect(state.observations.length).toBe(32);
  });
  it('breaks a stability streak after an invalid observation', () => {
    const obs = {
      detection: fixtureDetection(0, 100),
      quality: readyQuality,
      measurements: [],
      stage: 'front' as const,
    };
    let state = advanceScan(initialScan(), obs);
    state = advanceScan(state, {
      ...obs,
      detection: fixtureDetection(0, 300),
      quality: { ...readyQuality, valid: false },
    });
    expect(state.accepted).toBe(0);
  });
});
describe('robust temporal report', () => {
  it('uses each metric’s retained sample count for its reliability label', () => {
    const observations = Array.from({ length: 10 }, (_, i) => {
      const detection = fixtureDetection(0, i * 200);
      const measurements = measure(detection, readyQuality).map((m) =>
        m.id === 'face-ratio' && i >= 4 ? { ...m, value: null } : m,
      );
      return { detection, quality: readyQuality, measurements, stage: 'front' as const };
    });
    const metric = aggregate(observations, 'live').measurements.find((m) => m.id === 'face-ratio');
    expect(metric?.samples).toBe(4);
    expect(metric?.confidence).toBe('low');
  });
  it('does not mix turned observations into frontal measurements', () => {
    const front = fixtureDetection();
    const turned = fixtureDetection(22, 200);
    const analysis = aggregate(
      [
        {
          detection: front,
          quality: readyQuality,
          measurements: measure(front, readyQuality),
          stage: 'front',
        },
        {
          detection: turned,
          quality: { ...readyQuality, frontal: false },
          measurements: [],
          stage: 'left',
        },
      ],
      'guided',
    );
    expect(analysis.observationCount).toBe(2);
    expect(analysis.morphometryCount).toBe(1);
    expect(analysis.score.score).toBeNull();
    expect(analysis.measurements.every((m) => m.samples === 1)).toBe(true);
  });
  it('rejects an empty acquisition', () => {
    expect(() => aggregate([], 'live')).toThrow();
  });
});
