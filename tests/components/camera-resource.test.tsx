import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCamera } from '../../src/hooks/useCamera';
vi.mock('../../src/vision/client', () => ({
  visionClient: { init: vi.fn().mockResolvedValue(undefined), modeLabel: 'Test' },
}));
function Harness() {
  const { videoRef, start, stop } = useCamera();
  return (
    <>
      <video ref={videoRef} />
      <button
        onClick={() => {
          void start();
        }}
      >
        start
      </button>
      <button onClick={stop}>stop</button>
    </>
  );
}
afterEach(() => vi.restoreAllMocks());
it('stops a stream whose permission resolves after unmount', async () => {
  let resolve!: (s: MediaStream) => void;
  const pending = new Promise<MediaStream>((r) => {
    resolve = r;
  });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockReturnValue(pending) },
  });
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const { unmount } = render(<Harness />);
  fireEvent.click(screen.getByText('start'));
  unmount();
  resolve(stream);
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
});
it('cancels a camera request without opening a late stream', async () => {
  let resolve!: (s: MediaStream) => void;
  const pending = new Promise<MediaStream>((r) => {
    resolve = r;
  });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  const getUserMedia = vi.fn().mockReturnValue(pending);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  render(<Harness />);
  fireEvent.click(screen.getByText('start'));
  fireEvent.click(screen.getByText('stop'));
  resolve(stream);
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
});
