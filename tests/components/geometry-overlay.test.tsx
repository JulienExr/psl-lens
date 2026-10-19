import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh } from '../../src/components/Mesh';
import { LiveMesh, type LiveMeshHandle } from '../../src/components/LiveMesh';
import { fixtureDetection } from '../fixtures/face';

// jsdom has no raster backend. Record the drawing boundary; the scene is real.
function canvasRecorder() {
  const paths: number[][] = [];
  let current: number[] = [];
  let cleared = 0;
  const context = {
    setTransform: vi.fn(),
    clearRect: () => {
      cleared++;
      paths.length = 0;
    },
    beginPath: () => {
      current = [];
    },
    moveTo: (x: number, y: number) => {
      current.push(x, y);
    },
    lineTo: (x: number, y: number) => {
      current.push(x, y);
    },
    stroke: () => paths.push([...current]),
    arc: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return {
    paths,
    context,
    get cleared() {
      return cleared;
    },
  };
}
afterEach(() => vi.restoreAllMocks());
describe('formula overlay rendering', () => {
  it('shows only the selected scene, including numerator and denominator', () => {
    const { container, rerender } = render(
      <Mesh result={fixtureDetection()} layer="measurements" measurementId="face-ratio" />,
    );
    expect(container.querySelectorAll('line')).toHaveLength(2);
    expect(container.querySelector('[data-role="denominator"]')).toHaveAttribute('x1', '320');
    expect(screen.getByRole('img')).toHaveAccessibleName(/Largeur.*hauteur du visage/i);
    rerender(
      <Mesh result={fixtureDetection()} layer="measurements" measurementId="canthal-tilt" />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelectorAll('[data-role="axis"]')).toHaveLength(2);
  });
  it('retains mesh connections and limits points to the selected region', () => {
    const { container, rerender } = render(<Mesh result={fixtureDetection()} layer="mesh" />);
    expect(container.querySelectorAll('line').length).toBeGreaterThan(1000);
    rerender(<Mesh result={fixtureDetection()} layer="points" region="nose" />);
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });
  it('draws exact source pixels, redraws on selection and clears stopped detections', () => {
    const recorder = canvasRecorder();
    const ref = createRef<LiveMeshHandle>();
    const { container, rerender } = render(
      <LiveMesh ref={ref} layer="measurements" measurementId="face-ratio" />,
    );
    let elapsed = -1;
    act(() => {
      elapsed = ref.current!.draw(fixtureDetection());
    });
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(screen.getByRole('img')).toBeInstanceOf(HTMLCanvasElement);
    expect(container.querySelectorAll('line')).toHaveLength(0);
    expect(recorder.paths).toEqual([
      [128, 300.79999999999995, 512, 300.79999999999995],
      [320, 76.8, 320, 563.2],
    ]);
    expect(screen.getByRole('img')).toHaveAttribute('width', '640');
    rerender(<LiveMesh ref={ref} layer="measurements" measurementId="nose-ratio" />);
    expect(recorder.paths).toHaveLength(2);
    expect(recorder.paths[0][0]).toBeCloseTo(281.6);
    act(() => ref.current!.draw(null));
    expect(recorder.paths).toHaveLength(0);
    act(() => ref.current!.draw(fixtureDetection()));
    const invalid = fixtureDetection();
    delete invalid.faces[0][105];
    act(() => ref.current!.draw(invalid));
    expect(recorder.paths).toHaveLength(0);
  });
  it('honors all Live layers and region controls without per-connection DOM nodes', () => {
    const recorder = canvasRecorder();
    const ref = createRef<LiveMeshHandle>();
    const { container, rerender } = render(<LiveMesh ref={ref} layer="mesh" region="nose" />);
    act(() => ref.current!.draw(fixtureDetection()));
    expect(recorder.paths.flat()).toHaveLength(8);
    rerender(<LiveMesh ref={ref} layer="points" region="nose" />);
    expect(recorder.context.arc).toHaveBeenCalledTimes(4);
    rerender(<LiveMesh ref={ref} layer="mesh" region="all" />);
    expect(recorder.paths.flat().length).toBeGreaterThan(4000);
    expect(recorder.paths.length).toBe(1);
    rerender(<LiveMesh ref={ref} layer="video" />);
    expect(recorder.paths).toHaveLength(0);
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
  });
});
