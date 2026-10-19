import type { FaceDetectionResult } from '../types';
import type { RunningMode, VisionEngine } from './engine';
import { abortable, isVisionCancellation, VisionCancellation } from './cancellation';
import { RUNTIME_ASSETS } from './runtime-assets';

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
  init(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new VisionCancellation());
    return abortable(this.initialize(), signal);
  }
  private initialize(): Promise<void> {
    if (this.initialization) return this.initialization;
    const generation = this.generation;
    this.initialization = (async () => {
      try {
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
          throw new Error('Worker indisponible');
        const worker = new Worker(RUNTIME_ASSETS.workerUrl);
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
        await this.request(
          { type: 'init', origin: location.origin, assetBase: RUNTIME_ASSETS.assetBase },
          [],
          45000,
        );
        initializing = false;
      } catch (error) {
        if (generation !== this.generation) throw error;
        this.worker?.terminate();
        this.worker = null;
        const { VisionEngine } = await import('./engine');
        if (generation !== this.generation) throw new Error('Session effacée.', { cause: error });
        const fallback = new VisionEngine();
        try {
          await fallback.init(location.origin, RUNTIME_ASSETS.assetBase);
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
    signal?: AbortSignal,
  ): Promise<FaceDetectionResult> {
    if (signal?.aborted) {
      bitmap.close();
      throw new VisionCancellation();
    }
    if (this.activeOperation) {
      bitmap.close();
      throw new Error('Une analyse est déjà en cours.');
    }
    const operation = Symbol();
    const generation = this.generation;
    this.activeOperation = operation;
    let started = false;
    const cancelOwner = () => {
      if (this.activeOperation !== operation) return;
      // A worker inference cannot consume a cancellation message while WASM is
      // synchronous. Terminate only its owning session, then allow a fresh one.
      if (started) this.dispose(new VisionCancellation());
      else this.activeOperation = null;
    };
    signal?.addEventListener('abort', cancelOwner, { once: true });
    try {
      await this.init(signal);
      if (signal?.aborted || generation !== this.generation || this.activeOperation !== operation)
        throw new VisionCancellation();
      started = true;
      if (this.fallback) {
        const result = await abortable(this.fallback.detect(bitmap, mode, timestamp), signal);
        if (signal?.aborted || generation !== this.generation) throw new VisionCancellation();
        return result;
      }
      return (await this.request({ type: 'detect', bitmap, mode, timestamp }, [bitmap]))!;
    } catch (error) {
      if (
        !isVisionCancellation(error) &&
        generation === this.generation &&
        this.activeOperation === operation
      )
        this.dispose();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancelOwner);
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
  dispose(reason = new VisionCancellation()) {
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
