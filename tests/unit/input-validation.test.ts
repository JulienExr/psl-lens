import { describe, expect, it } from 'vitest';
import { validatePhoto } from '../../src/vision/photo';
import { assessQuality } from '../../src/vision/quality';
import { fixtureDetection } from '../fixtures/face';
describe('image and capture validation', () => {
  it('rejects empty, oversized and unsupported files', () => {
    expect(() => validatePhoto(new File([], 'empty.jpg', { type: 'image/jpeg' }))).toThrow('vide');
    expect(() => validatePhoto(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toThrow(
      'Format',
    );
    expect(() => validatePhoto({ type: 'image/jpeg', size: 21 * 1024 * 1024 } as File)).toThrow(
      'volumineuse',
    );
    expect(() => validatePhoto(new File(['x'], 'x.webp', { type: 'image/webp' }))).not.toThrow();
  });
  it('rejects small, clipped, tilted and strongly turned faces', () => {
    const pixels = { brightness: 130, sharpness: 80 };
    const small = fixtureDetection();
    small.faces[0] = small.faces[0].map((p) => ({
      ...p,
      x: 0.5 + (p.x - 0.5) * 0.2,
      y: 0.5 + (p.y - 0.5) * 0.2,
    }));
    expect(assessQuality(small, pixels).valid).toBe(false);
    const clipped = fixtureDetection();
    clipped.faces[0][10].y = 0.01;
    expect(assessQuality(clipped, pixels).valid).toBe(false);
    const tilted = fixtureDetection();
    tilted.pose.roll = 25;
    expect(assessQuality(tilted, pixels).valid).toBe(false);
    expect(assessQuality(fixtureDetection(80), pixels).valid).toBe(false);
  });
});
