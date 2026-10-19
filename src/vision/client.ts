import type { FaceDetectionResult } from '../types';
import type { RunningMode, VisionEngine } from './engine';

type Reply = { id: number; ok: boolean; result?: FaceDetectionResult; error?: string };
export class VisionClient {
  private worker: Worker | null = null;
  private fallback: VisionEngine | null = null;
  private initialization: Promise<void> | null = null;
  private pending = new Map<
    number,
    {
      resolve: (result?: FaceDetectionResult) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private nextId = 0;
  private activeOperation: symbol | null = null;
  private generation = 0;
  get modeLabel() {
    return this.fallback ? 'CPU · cadence limitée' : 'Worker · traitement local';
  }
  init(): Promise<void> {
    if (this.initialization) return this.initialization;
    const generation = this.generation;
    this.initialization = (async () => {
      try {
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
          throw new Error('Worker indisponible');
        const worker = new Worker('/vision-worker.js');
        this.worker = worker;
        let initializing = true;
        worker.onmessage = ({ data }: MessageEvent<Reply>) => {
          if (generation !== this.generation || this.worker !== worker) return;
          const request = this.pending.get(data.id);
          if (!request) return;
          clearTimeout(request.timer);
          this.pending.delete(data.id);
          if (data.ok) request.resolve(data.result);
          else request.reject(new Error(data.error));
        };
        worker.onerror = () => {
          if (generation !== this.generation || this.worker !== worker) return;
          if (initializing) this.rejectPending(new Error('Le moteur de vision ne répond pas.'));
          else
            this.dispose(new Error('Le moteur de vision a été interrompu. Réessayez l’analyse.'));
        };
        await this.request({ type: 'init', origin: location.origin }, [], 45000);
        initializing = false;
      } catch (error) {
        if (generation !== this.generation) throw error;
        this.worker?.terminate();
        this.worker = null;
        const { VisionEngine } = await import('./engine');
        if (generation !== this.generation) throw new Error('Session effacée.', { cause: error });
        const fallback = new VisionEngine();
        try {
          await fallback.init(location.origin);
        } catch (cause) {
          fallback.close();
          throw new Error(
            'Impossible de charger le moteur facial local. Vérifiez les fichiers du modèle et le support WebGL 2 de votre navigateur.',
            { cause },
          );
        }
        if (generation !== this.generation) {
          fallback.close();
          throw new Error('Session effacée.', { cause: error });
        }
        this.fallback = fallback;
      }
    })().catch((error) => {
      if (generation === this.generation) this.initialization = null;
      throw error;
    });
    return this.initialization;
  }
  private request(
    payload: object,
    transfer: Transferable[] = [],
    timeout = 15000,
  ): Promise<FaceDetectionResult | undefined> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error('Le traitement prend trop de temps. Réessayez avec une image plus petite.'),
        );
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker!.postMessage({ ...payload, id }, transfer);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error('Impossible de transférer cette image.', { cause: error }),
        );
      }
    });
  }
  async detect(
    bitmap: ImageBitmap,
    mode: RunningMode,
    timestamp: number,
  ): Promise<FaceDetectionResult> {
    if (this.activeOperation) {
      bitmap.close();
      throw new Error('Une analyse est déjà en cours.');
    }
    const operation = Symbol();
    const generation = this.generation;
    this.activeOperation = operation;
    try {
      await this.init();
      if (generation !== this.generation) throw new Error('Session effacée.');
      if (this.fallback) return await this.fallback.detect(bitmap, mode, timestamp);
      return (await this.request({ type: 'detect', bitmap, mode, timestamp }, [bitmap]))!;
    } catch (error) {
      if (generation === this.generation) this.dispose();
      throw error;
    } finally {
      bitmap.close();
      if (this.activeOperation === operation) this.activeOperation = null;
    }
  }
  private rejectPending(error: Error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }
  dispose(reason = new Error('Session effacée.')) {
    this.generation++;
    this.rejectPending(reason);
    this.activeOperation = null;
    this.worker?.terminate();
    this.worker = null;
    this.fallback?.close();
    this.fallback = null;
    this.initialization = null;
  }
}
export const visionClient = new VisionClient();
