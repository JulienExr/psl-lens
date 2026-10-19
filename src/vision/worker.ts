import { VisionEngine, type RunningMode } from './engine';
const engine = new VisionEngine();
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: 'init' | 'detect';
    origin?: string;
    bitmap?: ImageBitmap;
    mode?: RunningMode;
    timestamp?: number;
  }>,
) => {
  const { id, type, bitmap } = event.data;
  try {
    if (type === 'init') {
      await engine.init(event.data.origin!);
      self.postMessage({ id, ok: true });
    } else if (bitmap) {
      const result = await engine.detect(bitmap, event.data.mode!, event.data.timestamp!);
      self.postMessage({ id, ok: true, result });
    }
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Échec de détection.',
    });
  } finally {
    bitmap?.close();
  }
};
