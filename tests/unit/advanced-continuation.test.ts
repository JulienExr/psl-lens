import { expect, it } from 'vitest';
import { buildAdvancedContinuation } from '../../src/vision/advanced';
import { initialScan } from '../../src/vision/scan';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { measure } from '../../src/morphometry/metrics';
const obs = (yaw: number, stage: 'front' | 'left' = 'front', value = 0.7) => {
  const d = fixtureDetection(yaw);
  return {
    detection: d,
    quality: { ...readyQuality, frontal: yaw === 0 },
    measurements: measure(d, readyQuality, { allowApproximate: true }).map((m) =>
      m.id === 'face-ratio' ? { ...m, value } : m,
    ),
    stage,
  };
};
it('preserves known stages and excludes obliques from an unfinished advanced scan frontal estimate', () => {
  const front = Array.from({ length: 16 }, () => obs(0));
  const left = Array.from({ length: 3 }, () => obs(22, 'left', 1.6));
  const r = buildAdvancedContinuation(
    {
      ...initialScan('multi-angle'),
      stageIndex: 1,
      accepted: 3,
      observations: [...front, ...left],
    },
    [...front, ...left],
    [],
  );
  expect(r?.morphometryCount).toBe(16);
  expect(r?.measurements.find((m) => m.id === 'face-ratio')?.value).toBe(0.7);
  expect(r?.views?.map((v) => v.view)).toEqual(['front', 'oblique-left']);
  expect(r?.scan?.consistency.status).toBe('not-checked');
  expect(r?.frontalScore.score).not.toBeNull();
});
it('keeps a partial accepted frontal series separate from unaccepted rotated observations', () => {
  const front = Array.from({ length: 3 }, () => obs(0));
  const r = buildAdvancedContinuation(
    { ...initialScan('multi-angle'), observations: front },
    [...front, obs(22, 'front', 1.6)],
    [],
  );
  expect(r?.morphometryCount).toBe(3);
  expect(r?.measurements.find((m) => m.id === 'face-ratio')?.value).toBe(0.7);
  expect(r?.source).toBe('live');
  expect(r?.frontalScore.reliability).toBe('limited');
});
it('uses one latest approximate observation only when no strict front was acquired', () => {
  const r = buildAdvancedContinuation(
    initialScan('multi-angle'),
    [obs(0, 'front', 0.6), obs(22, 'front', 1.1)],
    [],
  );
  expect(r?.morphometryCount).toBe(1);
  expect(r?.measurements.find((m) => m.id === 'face-ratio')?.value).toBe(1.1);
  expect(r?.frontalScore.score).not.toBeNull();
  expect(buildAdvancedContinuation(initialScan(), [], [])).toBeUndefined();
});

it('keeps an indicative oblique fallback orientation instead of claiming a frontal acquisition', () => {
  const r = buildAdvancedContinuation(initialScan('multi-angle'), [obs(22, 'front', 1.1)], [])!;
  expect(r.representative.pose.yaw).toBe(22);
  expect(r.source).toBe('live');
  expect(r.scan).toBeUndefined();
  expect(r.views?.[0].view).toBe('oblique-left');
  expect(r.measurements.find((m) => m.value !== null)?.provenance?.view).toBe('oblique-left');
  expect(r.captureIssues?.join(' ')).toMatch(/oblique.*aucune acquisition frontale/i);
  expect(r.frontalScore.score).not.toBeNull();
  expect(r.frontalScore.reliability).toBe('limited');
});

it('does not infer a front view when the pose is unknown or tilted out of plane', () => {
  const unknown = obs(0);
  unknown.detection.pose.source = 'unavailable';
  const tilted = obs(0);
  tilted.detection.pose.pitch = 25;
  for (const [o, view] of [
    [unknown, 'orientation-unknown'],
    [tilted, 'non-frontal'],
  ] as const) {
    const r = buildAdvancedContinuation(initialScan(), [o], [])!;
    expect(r.views?.[0].view).toBe(view);
    expect(r.measurements[0].provenance?.view).toBe(view);
    expect(r.frontalScore.reliability).toBe('limited');
  }
});
