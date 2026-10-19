import type { CaptureQuality, FaceDetectionResult, FacePose, PixelQuality } from '../types';
import { distance, hasFaceBaselines } from '../morphometry/geometry';

export function poseFromMatrix(m: number[]): FacePose {
  if (m.length !== 16 || !m.every(Number.isFinite))
    return { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
  // MediaPipe MatrixData is column-major. Remove scale before extracting XYZ rotation.
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  if (Math.min(sx, sy, sz) < 1e-6) return { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
  const cols = [
    [m[0] / sx, m[1] / sx, m[2] / sx],
    [m[4] / sy, m[5] / sy, m[6] / sy],
    [m[8] / sz, m[9] / sz, m[10] / sz],
  ];
  const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const determinant =
    cols[0][0] * (cols[1][1] * cols[2][2] - cols[1][2] * cols[2][1]) -
    cols[1][0] * (cols[0][1] * cols[2][2] - cols[0][2] * cols[2][1]) +
    cols[2][0] * (cols[0][1] * cols[1][2] - cols[0][2] * cols[1][1]);
  if (
    Math.max(
      Math.abs(dot(cols[0], cols[1])),
      Math.abs(dot(cols[0], cols[2])),
      Math.abs(dot(cols[1], cols[2])),
    ) > 0.02 ||
    Math.abs(determinant - 1) > 0.02 ||
    Math.abs(m[3]) > 1e-6 ||
    Math.abs(m[7]) > 1e-6 ||
    Math.abs(m[11]) > 1e-6 ||
    Math.abs(m[15] - 1) > 1e-6
  )
    return { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
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
    neutralExpression: false,
  };
  if (
    result.faces.length !== 1 ||
    points.length < 478 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) ||
    ![result.width, result.height, result.timestamp].every(Number.isFinite) ||
    result.width <= 0 ||
    result.height <= 0 ||
    !hasFaceBaselines(points.map((p) => ({ x: p.x * result.width, y: p.y * result.height })))
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
  const poseAvailable =
    result.pose.source === 'matrix' &&
    [result.pose.yaw, result.pose.pitch, result.pose.roll].every(Number.isFinite);
  if (!poseAvailable) issues.push('Orientation du visage indisponible.');
  if (
    Math.abs(result.pose.yaw) > 35 ||
    Math.abs(result.pose.pitch) > 15 ||
    Math.abs(result.pose.roll) > 20
  )
    issues.push('Redressez la tête et limitez la rotation.');
  if (!pixels || ![pixels.brightness, pixels.sharpness].every(Number.isFinite))
    issues.push('Qualité lumineuse et netteté non vérifiées.');
  else {
    if (pixels.brightness < 45) issues.push('Ajoutez une lumière douce devant le visage.');
    if (pixels.brightness > 225) issues.push('Réduisez la surexposition.');
    if (pixels.sharpness < 12) issues.push('Image trop floue : stabilisez la caméra.');
  }
  const b = result.blendshapes;
  const expressionAvailable = [
    'mouthSmileLeft',
    'mouthSmileRight',
    'jawOpen',
    'eyeBlinkLeft',
    'eyeBlinkRight',
  ].every((key) => Number.isFinite(b[key]) && b[key] >= 0 && b[key] <= 1);
  const neutralExpression =
    expressionAvailable &&
    Math.max(b.mouthSmileLeft, b.mouthSmileRight) <= 0.55 &&
    b.jawOpen <= 0.3 &&
    Math.max(b.eyeBlinkLeft, b.eyeBlinkRight) <= 0.65;
  if (!expressionAvailable)
    issues.push('Expression neutre non vérifiée : coefficients indisponibles.');
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
    const previousValid =
      previous.faces[0].every((p) => [p.x, p.y, p.z].every(Number.isFinite)) &&
      previous.pose.source === 'matrix' &&
      [previous.pose.yaw, previous.pose.pitch, previous.pose.roll].every(Number.isFinite) &&
      previous.width === result.width &&
      previous.height === result.height;
    if (!previousValid) issues.push('Stabilité non vérifiée : observation précédente invalide.');
    const pointMotion = distance(points[1], previous.faces[0][1]);
    const poseMotion = Math.max(
      Math.abs(result.pose.yaw - previous.pose.yaw),
      Math.abs(result.pose.pitch - previous.pose.pitch),
    );
    stability =
      previousValid && poseAvailable ? Math.max(pointMotion / 0.018, poseMotion / 4) : null;
    if (stability !== null && stability > 1) issues.push('Restez immobile un instant.');
  }
  return {
    ...base,
    faceSize,
    stability,
    frontal: poseAvailable && Math.abs(result.pose.yaw) <= 12 && Math.abs(result.pose.pitch) <= 12,
    issues,
    neutralExpression,
    valid: !issues.length,
    label: issues.length ? 'adjust' : 'ready',
  };
}
