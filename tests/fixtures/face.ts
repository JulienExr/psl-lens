import type { CaptureQuality, FaceDetectionResult } from '../../src/types';
export const readyQuality: CaptureQuality = {
  valid: true,
  frontal: true,
  issues: [],
  brightness: 130,
  sharpness: 80,
  faceSize: 0.6,
  stability: 0,
  label: 'ready',
};
// Synthetic coordinates for unit tests only; never imported by production code.
export function fixtureDetection(yaw = 0, timestamp = 0): FaceDetectionResult {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const put = (i: number, x: number, y: number) => {
    points[i] = { x, y, z: 0 };
  };
  put(10, 0.5, 0.12);
  put(152, 0.5, 0.88);
  put(234, 0.2, 0.47);
  put(454, 0.8, 0.47);
  put(33, 0.3, 0.38);
  put(133, 0.43, 0.38);
  put(362, 0.57, 0.38);
  put(263, 0.7, 0.38);
  put(468, 0.365, 0.38);
  put(473, 0.635, 0.38);
  put(159, 0.365, 0.36);
  put(145, 0.365, 0.4);
  put(386, 0.635, 0.36);
  put(374, 0.635, 0.4);
  put(105, 0.365, 0.29);
  put(334, 0.635, 0.29);
  put(107, 0.44, 0.29);
  put(336, 0.56, 0.29);
  put(168, 0.5, 0.39);
  put(2, 0.5, 0.59);
  put(98, 0.44, 0.56);
  put(327, 0.56, 0.56);
  put(61, 0.38, 0.69);
  put(291, 0.62, 0.69);
  put(17, 0.5, 0.73);
  put(172, 0.28, 0.75);
  put(397, 0.72, 0.75);
  return {
    faces: [points],
    width: 640,
    height: 640,
    timestamp,
    inferenceMs: 25,
    pose: { yaw, pitch: 0, roll: 0, source: 'matrix' },
    matrix: [],
    blendshapes: {},
  };
}
