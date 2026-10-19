import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisionClient } from '../../src/vision/client';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: object }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  messages: { id: number; type: string }[] = [];
  throwPost = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: { id: number; type: string }) {
    if (this.throwPost) throw new DOMException('Cannot clone', 'DataCloneError');
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  initialized() {
    this.onmessage?.({ data: { id: this.messages[0].id, ok: true } });
  }
}
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('OffscreenCanvas', class {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('vision lifecycle', () => {
  it('does not terminate a new worker when an old initialization is cancelled', async () => {
    const client = new VisionClient();
    const old = client.init().catch(() => undefined);
    client.dispose();
    const fresh = client.init();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWorker.instances[1].terminated).toBe(false);
    FakeWorker.instances[1].initialized();
    await fresh;
    await old;
    client.dispose();
  });
  it('recovers with a fresh worker after a runtime crash', async () => {
    const client = new VisionClient();
    const first = client.init();
    FakeWorker.instances[0].initialized();
    await first;
    FakeWorker.instances[0].onerror?.();
    const retry = client.init();
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].initialized();
    await retry;
    client.dispose();
  });
  it('clears the timeout after a synchronous postMessage failure', async () => {
    vi.useFakeTimers();
    const client = new VisionClient();
    const ready = client.init();
    FakeWorker.instances[0].initialized();
    await ready;
    FakeWorker.instances[0].throwPost = true;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    await expect(client.detect(bitmap, 'IMAGE', 100)).rejects.toThrow(
      'Impossible de transférer cette image.',
    );
    expect(vi.getTimerCount()).toBe(0);
    client.dispose();
  });
});
