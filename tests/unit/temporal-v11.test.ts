import { describe, expect, it } from 'vitest';
import { aggregate } from '../../src/vision/temporal';
import { measure } from '../../src/morphometry/metrics';
import { fixtureDetection, readyQuality } from '../fixtures/face';
const observation = (i = 0) => {
  const detection = fixtureDetection(0, i * 200);
  return {
    detection,
    quality: readyQuality,
    measurements: measure(detection, readyQuality),
    stage: 'front' as const,
  };
};
describe('frontal report evidence', () => {
  it('scores a valid single photo with explicit limited reliability and unknown dispersion', () => {
    const report = aggregate([observation()], 'photo');
    expect(report.frontalScore.score).not.toBeNull();
    expect(report.frontalScore.reliability).toBe('limited');
    expect(report.score.score).toBeNull();
    expect(
      report.measurements.every(
        (m) => m.spread === undefined && m.reliabilityReason === 'single-photo',
      ),
    ).toBe(true);
  });
  it('does not hide substantial rejection behind a zero retained MAD', () => {
    const input = Array.from({ length: 16 }, (_, i) => {
      const o = observation(i);
      o.measurements = o.measurements.map((m) =>
        m.id === 'face-ratio' ? { ...m, value: i < 10 ? 1 : 1.8 } : m,
      );
      return o;
    });
    const report = aggregate(input, 'guided');
    const metric = report.measurements.find((m) => m.id === 'face-ratio')!;
    expect(metric.spread).toBe(0);
    expect(metric.retention).toBe(0.625);
    expect(metric.confidence).toBe('low');
    expect(metric.reliabilityReason).toBe('outliers');
    expect(report.frontalScore.score).toBeNull();
  });
  it('scores a stable Quick Scan and refuses a series containing oblique score inputs', () => {
    const observations = Array.from({ length: 16 }, (_, i) => observation(i));
    expect(aggregate(observations, 'guided').frontalScore.score).not.toBeNull();
    observations[0].detection.pose.yaw = 10;
    expect(aggregate(observations, 'guided').frontalScore.score).toBeNull();
  });
});
