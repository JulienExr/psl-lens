import type { CaptureQuality, FaceDetectionResult, FacePose, PixelQuality } from '../types';
import { distance } from '../morphometry/geometry';

export function poseFromMatrix(m: number[]): FacePose {
  if (m.length !== 16 || !m.every(Number.isFinite))
    return { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
  // MediaPipe MatrixData is column-major. Remove scale before extracting XYZ rotation.
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  if (Math.min(sx, sy, sz) < 1e-6) return { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
  const deg = 180 / Math.PI;
  return {
    yaw: Math.asin(Math.max(-1, Math.min(1, -m[2] / sx))) * deg || 0,
    pitch: Math.atan2(m[6] / sy, m[10] / sz) * deg,
    roll: Math.atan2(m[1] / sx, m[0] / sx) * deg,
    source: 'matrix',
  };
}
export function pixelQuality(data: Uint8ClampedArray, width: number, height: number): PixelQuality {
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    sum += gray[i];
  }
  let lap = 0;
  let lap2 = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      lap += v;
      lap2 += v * v;
      n++;
    }
  return {
    brightness: gray.length ? sum / gray.length : 0,
    sharpness: n ? Math.max(0, lap2 / n - (lap / n) ** 2) : 0,
  };
}
export function assessQuality(
  result: FaceDetectionResult,
  pixels: PixelQuality | null,
  previous?: FaceDetectionResult,
): CaptureQuality {
  const issues: string[] = [];
  const points = result.faces[0] ?? [];
  const base = {
    brightness: pixels?.brightness ?? null,
    sharpness: pixels?.sharpness ?? null,
    faceSize: 0,
    stability: null,
    frontal: false,
  };
  if (
    result.faces.length !== 1 ||
    points.length < 478 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  ) {
    return {
      ...base,
      valid: false,
      label: result.faces.length ? 'adjust' : 'no-face',
      issues: [
        result.faces.length > 1
          ? 'Gardez un seul visage dans le cadre.'
          : 'Aucun visage exploitable détecté.',
      ],
    };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const faceSize = maxY - minY;
  if (faceSize < 0.28) issues.push('Rapprochez-vous : le visage est trop petit.');
  if (minX < 0.025 || maxX > 0.975 || minY < 0.025 || maxY > 0.975)
    issues.push('Gardez tout le visage dans le cadre.');
  if (result.pose.source === 'unavailable') issues.push('Orientation du visage indisponible.');
  if (
    Math.abs(result.pose.yaw) > 35 ||
    Math.abs(result.pose.pitch) > 15 ||
    Math.abs(result.pose.roll) > 20
  )
    issues.push('Redressez la tête et limitez la rotation.');
  if (!pixels) issues.push('Qualité lumineuse et netteté non vérifiées.');
  else {
    if (pixels.brightness < 45) issues.push('Ajoutez une lumière douce devant le visage.');
    if (pixels.brightness > 225) issues.push('Réduisez la surexposition.');
    if (pixels.sharpness < 12) issues.push('Image trop floue : stabilisez la caméra.');
  }
  const b = result.blendshapes;
  if (
    Math.max(b.mouthSmileLeft ?? 0, b.mouthSmileRight ?? 0) > 0.55 ||
    (b.jawOpen ?? 0) > 0.3 ||
    Math.max(b.eyeBlinkLeft ?? 0, b.eyeBlinkRight ?? 0) > 0.65
  )
    issues.push('Gardez une expression neutre et les yeux ouverts.');
  let stability: number | null = null;
  if (
    previous?.faces.length === 1 &&
    previous.faces[0].length >= 478 &&
    result.timestamp > previous.timestamp &&
    result.timestamp - previous.timestamp < 800
  ) {
    const pointMotion = distance(points[1], previous.faces[0][1]);
    const poseMotion = Math.max(
      Math.abs(result.pose.yaw - previous.pose.yaw),
      Math.abs(result.pose.pitch - previous.pose.pitch),
    );
    stability = Math.max(pointMotion / 0.018, poseMotion / 4);
    if (stability > 1) issues.push('Restez immobile un instant.');
  }
  return {
    ...base,
    faceSize,
    stability,
    frontal:
      result.pose.source === 'matrix' &&
      Math.abs(result.pose.yaw) <= 12 &&
      Math.abs(result.pose.pitch) <= 12,
    issues,
    valid: !issues.length,
    label: issues.length ? 'adjust' : 'ready',
  };
}
