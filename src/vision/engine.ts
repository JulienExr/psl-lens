import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceDetectionResult, PixelQuality } from '../types';
import { pixelQuality, poseFromMatrix } from './quality';

export type RunningMode = 'IMAGE' | 'VIDEO';
export class VisionEngine {
  private model: FaceLandmarker | null = null;
  private mode: RunningMode = 'IMAGE';
  async init(origin: string, assetBase = '/') {
    // CPU inference still uses WebGL for MediaPipe image transport. Some WebKit
    // versions expose OffscreenCanvas but cannot create a WebGL context in workers.
    const canvas =
      typeof document !== 'undefined'
        ? document.createElement('canvas')
        : new OffscreenCanvas(1, 1);
    canvas.width = canvas.height = 1;
    if (!canvas.getContext('webgl2'))
      throw new Error(
        'WebGL 2 est indisponible dans ce contexte. Essayez un navigateur récent avec l’accélération graphique activée.',
      );
    const base = `${origin}${assetBase === '/' ? '' : assetBase.replace(/\/$/, '')}`;
    const files = await FilesetResolver.forVisionTasks(`${base}/wasm`);
    this.model = await FaceLandmarker.createFromOptions(files, {
      canvas,
      baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 2,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }
  async detect(
    bitmap: ImageBitmap,
    mode: RunningMode,
    timestamp: number,
  ): Promise<FaceDetectionResult> {
    if (!this.model) throw new Error('Le modèle n’est pas chargé.');
    if (mode !== this.mode) {
      await this.model.setOptions({ runningMode: mode });
      this.mode = mode;
    }
    const started = performance.now();
    const result =
      mode === 'VIDEO' ? this.model.detectForVideo(bitmap, timestamp) : this.model.detect(bitmap);
    const matrix = result.facialTransformationMatrixes[0]?.data ?? [];
    const detection: FaceDetectionResult = {
      faces: result.faceLandmarks,
      pose: poseFromMatrix(matrix),
      matrix,
      blendshapes: Object.fromEntries(
        (result.faceBlendshapes[0]?.categories ?? []).map((c) => [c.categoryName, c.score]),
      ),
      width: bitmap.width,
      height: bitmap.height,
      timestamp,
      inferenceMs: performance.now() - started,
    };
    detection.pixels = samplePixels(bitmap, detection);
    return detection;
  }
  close() {
    this.model?.close();
    this.model = null;
  }
}
function samplePixels(bitmap: ImageBitmap, result: FaceDetectionResult): PixelQuality | null {
  if (result.faces.length !== 1) return null;
  try {
    const p = result.faces[0];
    const x = Math.max(0, Math.min(...p.map((v) => v.x)) * bitmap.width);
    const y = Math.max(0, Math.min(...p.map((v) => v.y)) * bitmap.height);
    const w = Math.min(bitmap.width - x, Math.max(...p.map((v) => v.x)) * bitmap.width - x);
    const h = Math.min(bitmap.height - y, Math.max(...p.map((v) => v.y)) * bitmap.height - y);
    if (w <= 0 || h <= 0) return null;
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(128, 128)
        : Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, 128, 128);
    return pixelQuality(ctx.getImageData(0, 0, 128, 128).data, 128, 128);
  } catch {
    return null;
  }
}
