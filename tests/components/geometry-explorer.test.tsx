import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeometryExplorer from '../../src/components/GeometryExplorer';
import { fixtureDetection } from '../fixtures/face';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('optional geometry explorer', () => {
  it('explains the estimated geometry and provides a usable 2D fallback without Canvas2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<GeometryExplorer result={fixtureDetection()} />);
    expect(screen.getByText(/ni un scan anatomique ni une mesure métrique/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Géométrie relative estimée.*2D/i })).toBeInstanceOf(
      SVGSVGElement,
    );
    expect(screen.getByRole('button', { name: 'Vue estimée 3D' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Rotation horizontale' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Afficher' }), {
      target: { value: 'points' },
    });
    expect(document.querySelectorAll('circle').length).toBe(478);
  });

  it('updates geometry with accessible controls, resets camera only, and stops observers on unmount', () => {
    let redraw: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          redraw = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const paths: number[][] = [];
    let path: number[] = [];
    const context = {
      setTransform() {},
      clearRect() {
        paths.length = 0;
      },
      beginPath() {
        path = [];
      },
      moveTo(x: number, y: number) {
        path.push(x, y);
      },
      lineTo(x: number, y: number) {
        path.push(x, y);
      },
      stroke() {
        paths.push(path);
      },
      arc() {},
      fill() {},
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const frame = vi.spyOn(window, 'requestAnimationFrame');
    const result = fixtureDetection();
    result.faces[0][168].z = -0.15;
    const { unmount } = render(<GeometryExplorer result={result} />);
    const initial = JSON.stringify(paths);
    fireEvent.change(screen.getByRole('slider', { name: 'Rotation horizontale' }), {
      target: { value: '45' },
    });
    expect(JSON.stringify(paths)).not.toBe(initial);
    expect(screen.getByText(/Vue estimée tournée/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la vue' }));
    expect(JSON.stringify(paths)).toBe(initial);
    expect(screen.getByText(/orientation canonique de la caméra/)).toBeInTheDocument();
    redraw?.();
    expect(frame).not.toHaveBeenCalled();

    const canvas = screen.getByRole('img');
    const pointer = (type: string, pointerId: number, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerId', { value: pointerId });
      fireEvent(canvas, event);
    };
    pointer('pointerdown', 1, 100, 100);
    pointer('pointermove', 1, 140, 120);
    expect(screen.getByRole('slider', { name: 'Rotation horizontale' })).toHaveValue('20');
    expect(screen.getByRole('slider', { name: 'Rotation verticale' })).toHaveValue('-10');
    pointer('pointerdown', 2, 240, 120);
    pointer('pointermove', 2, 340, 120);
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
    pointer('pointercancel', 1, 140, 120);
    pointer('pointerup', 2, 340, 120);
    pointer('pointermove', 1, 180, 180);
    expect(screen.getByRole('slider', { name: 'Rotation horizontale' })).toHaveValue('20');

    fireEvent.click(screen.getByRole('button', { name: 'Vue plane 2D' }));
    expect(screen.getByRole('img')).toBeInstanceOf(SVGSVGElement);
    const flatPath = document.querySelector('path')!.getAttribute('d');
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '1' } });
    expect(document.querySelector('path')!.getAttribute('d')).not.toBe(flatPath);
    fireEvent.click(screen.getByRole('button', { name: 'Vue estimée 3D' }));
    expect(screen.getByRole('img')).toBeInstanceOf(HTMLCanvasElement);
    expect(screen.getByRole('slider', { name: 'Rotation horizontale' })).toHaveValue('20');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('handles empty results with a clear unavailable state', () => {
    render(<GeometryExplorer result={null} />);
    expect(screen.getByText(/Une détection unique avec des repères valides/)).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
