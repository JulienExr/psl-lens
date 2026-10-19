import { afterEach, expect, it, vi } from 'vitest';
import { VisionClient } from '../../src/vision/client';
import { fixtureDetection } from '../fixtures/face';
const engines = vi.hoisted(() => ({ instances: [] as { closed: boolean; finish?: () => void }[] }));
vi.mock('../../src/vision/engine', () => ({
  VisionEngine: class {
    closed = false;
    finish?: () => void;
    constructor() {
      engines.instances.push(this);
    }
    async init() {}
    detect() {
      return new Promise((resolve) => {
        this.finish = () => resolve(fixtureDetection());
      });
    }
    close() {
      this.closed = true;
    }
  },
}));
afterEach(() => {
  engines.instances = [];
  vi.unstubAllGlobals();
});
it('invalidates a pending CPU fallback without closing its successor', async () => {
  vi.stubGlobal('OffscreenCanvas', undefined);
  const client = new VisionClient();
  const controller = new AbortController();
  await client.init();
  const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap;
  const old = client.detect(bitmap(), 'VIDEO', 1, controller.signal).catch((error) => error);
  await vi.waitFor(() => expect(engines.instances[0].finish).toBeDefined());
  controller.abort();
  expect((await old).name).toBe('AbortError');
  expect(engines.instances[0].closed).toBe(true);
  const fresh = client.detect(bitmap(), 'IMAGE', 2);
  await vi.waitFor(() => expect(engines.instances[1]?.finish).toBeDefined());
  engines.instances[0].finish?.();
  controller.abort();
  expect(engines.instances[1].closed).toBe(false);
  engines.instances[1].finish?.();
  await expect(fresh).resolves.toMatchObject({ width: 640 });
  client.dispose();
});
