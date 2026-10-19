import { describe, expect, it } from 'vitest';
import { advanceScan, initialScan, assessScanConsistency } from '../../src/vision/scan';
import { measure } from '../../src/morphometry/metrics';
import { fixtureDetection, readyQuality } from '../fixtures/face';
const observation = (stage: 'front' | 'left' | 'right', yaw: number, timestamp: number) => {
  const detection = fixtureDetection(yaw, timestamp);
  return {
    detection,
    quality: { ...readyQuality, frontal: stage === 'front' },
    measurements: measure(detection, readyQuality),
    stage,
  };
};
describe('honest quick and multi-angle protocols', () => {
  it('finishes a default Quick Scan on sixteen real frontal observations only', () => {
    let state = initialScan();
    for (let n = 1; n <= 16; n++) state = advanceScan(state, observation('front', 0, n * 200));
    expect(state.complete).toBe(true);
    expect(state.mode).toBe('quick');
    expect(state.observations).toHaveLength(16);
  });
  it('requires the optional oblique stages and checks geometric continuity', () => {
    const valid = [
      ...Array.from({ length: 16 }, (_, i) => observation('front', 0, i * 200)),
      ...Array.from({ length: 8 }, (_, i) => observation('left', 22, 4000 + i * 200)),
      ...Array.from({ length: 8 }, (_, i) => observation('right', -22, 6000 + i * 200)),
    ];
    expect(assessScanConsistency(valid).status).toBe('consistent');
    const inconsistent = valid.map((o) =>
      o.stage === 'right'
        ? {
            ...o,
            detection: {
              ...o.detection,
              faces: [
                o.detection.faces[0].map((p) => ({
                  ...p,
                  x: 0.5 + (p.x - 0.5) * 0.5,
                  y: 0.5 + (p.y - 0.5) * 0.5,
                })),
              ],
            },
          }
        : o,
    );
    expect(assessScanConsistency(inconsistent).status).toBe('inconsistent');
    expect(assessScanConsistency(inconsistent).issues.length).toBeGreaterThan(0);
    expect(assessScanConsistency(valid.filter((o) => o.stage !== 'right')).status).toBe(
      'not-checked',
    );
  });
  it('does not label a Quick Scan as multi-angle validated', () => {
    expect(assessScanConsistency([observation('front', 0, 200)]).status).toBe('not-checked');
  });
});
