import { expect, it } from 'vitest';
import { initialScan, restartScanStage } from '../../src/vision/scan';
import { fixtureDetection, readyQuality } from '../fixtures/face';
it('restarts only the current stage and retains acquired earlier views', () => {
  const front = {
    detection: fixtureDetection(),
    quality: readyQuality,
    measurements: [],
    stage: 'front' as const,
  };
  const left = { ...front, stage: 'left' as const };
  const right = { ...front, stage: 'right' as const };
  const state = {
    ...initialScan('multi-angle'),
    stageIndex: 1,
    accepted: 3,
    observations: [front, left],
  };
  const reset = restartScanStage(state);
  expect(reset.observations).toEqual([front]);
  expect(reset.accepted).toBe(0);
  expect(reset.stageIndex).toBe(1);
  expect(state.observations).toHaveLength(2);
  const finished = restartScanStage({
    ...state,
    stageIndex: 3,
    complete: true,
    observations: [front, left, right],
  });
  expect(finished.stageIndex).toBe(2);
  expect(finished.observations).toEqual([front, left]);
  expect(finished.complete).toBe(false);
});
