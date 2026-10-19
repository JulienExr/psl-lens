import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisionClient } from '../../src/vision/client';
import { fixtureDetection } from '../fixtures/face';
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
  complete(result = fixtureDetection()) {
    this.onmessage?.({ data: { id: this.messages.at(-1)!.id, ok: true, result } });
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
  it('aborts only the pending owner and lets an immediate new detection succeed', async () => {
    const client = new VisionClient();
    const ready = client.init();
    FakeWorker.instances[0].initialized();
    await ready;
    const controller = new AbortController();
    const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap;
    const old = client.detect(bitmap(), 'VIDEO', 100, controller.signal).catch((error) => error);
    try {
      await Promise.resolve();
      await Promise.resolve();
      controller.abort();
      expect(FakeWorker.instances[0].terminated).toBe(true);
      const fresh = client.detect(bitmap(), 'VIDEO', 200);
      FakeWorker.instances[1].initialized();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      controller.abort();
      FakeWorker.instances[0].onerror?.();
      expect(FakeWorker.instances[1].terminated).toBe(false);
      FakeWorker.instances[1].complete();
      await expect(fresh).resolves.toMatchObject({ width: 640 });
      expect((await old).name).toBe('AbortError');
    } finally {
      client.dispose();
      await old;
    }
  });
  it('cancels waiting inference without destroying an initialization shared by its successor', async () => {
    const client = new VisionClient();
    const controller = new AbortController();
    const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap;
    const old = client.detect(bitmap(), 'VIDEO', 100, controller.signal).catch((error) => error);
    try {
      controller.abort();
      await Promise.resolve();
      await Promise.resolve();
      expect((await old).name).toBe('AbortError');
      const fresh = client.detect(bitmap(), 'IMAGE', 200);
      expect(FakeWorker.instances).toHaveLength(1);
      FakeWorker.instances[0].initialized();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      FakeWorker.instances[0].complete();
      await expect(fresh).resolves.toMatchObject({ width: 640 });
      expect(FakeWorker.instances[0].messages.filter((m) => m.type === 'detect')).toHaveLength(1);
    } finally {
      client.dispose();
    }
  });
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
