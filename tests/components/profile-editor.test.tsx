import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from '../../src/features/Profile';

const confirmation = () => screen.getByRole('checkbox', { name: /Je confirme une vue latérale/ });
const undo = () => screen.getByRole('button', { name: 'Annuler' });
const editor = () => screen.getByRole('img', { name: 'Photo de profil et repères manuels' });
const coordinate = (name: string, axis: 'X' | 'Y') =>
  screen.getByRole('spinbutton', { name: `${name} ${axis} (%)` });
const selectPoint = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^\\d+\\. ${name}`) }));
const pointer = (target: Element, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
};

function renderEditor() {
  render(
    <MemoryRouter>
      <Profile
        initial={{
          preview: 'data:image/png;base64,photo',
          width: 1000,
          height: 1000,
          source: 'import',
        }}
        onComplete={vi.fn()}
      />
    </MemoryRouter>,
  );
}

function placeRequiredPoints() {
  for (const [name, x, y] of [
    ['Racine du nez', 50, 20],
    ['Pointe du nez', 70, 35],
    ['Base du nez', 60, 40],
    ['Avant du menton', 60, 60],
    ['Bas du menton', 50, 75],
  ] as const) {
    selectPoint(name);
    fireEvent.change(coordinate(name, 'X'), { target: { value: String(x) } });
    fireEvent.change(coordinate(name, 'Y'), { target: { value: String(y) } });
  }
  fireEvent.click(confirmation());
  expect(screen.getByRole('button', { name: 'Valider et voir le rapport' })).toBeEnabled();
}

beforeEach(() => {
  // jsdom has no SVG coordinate transforms or pointer capture; the image uses an identity viewport.
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: vi.fn(() => ({ inverse: () => ({}) })),
  });
  Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    'DOMPoint',
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform() {
        return this;
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (SVGSVGElement.prototype as Partial<SVGSVGElement>).getScreenCTM;
  delete (SVGSVGElement.prototype as Partial<SVGSVGElement>).setPointerCapture;
});

describe('profile editor confirmation and meaningful undo history', () => {
  it('preserves confirmation and the last point edit through zoom, pan and recentering', () => {
    renderEditor();
    placeRequiredPoints();
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom du profil' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Placer les repères' }));
    pointer(editor(), 'pointerdown', 200, 200);
    pointer(editor(), 'pointermove', 240, 260);
    pointer(editor(), 'pointerup', 240, 260);
    expect(confirmation()).toBeChecked();
    expect(screen.getByRole('button', { name: 'Valider et voir le rapport' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recentrer' }));
    expect(confirmation()).toBeChecked();
    fireEvent.click(undo());
    expect(coordinate('Bas du menton', 'Y')).toHaveValue(50);
    expect(confirmation()).not.toBeChecked();
  });

  it('does not create undo entries for panning or resetting an empty editor', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les points' }));
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Placer les repères' }));
    pointer(editor(), 'pointerdown', 100, 100);
    pointer(editor(), 'pointermove', 180, 180);
    pointer(editor(), 'pointerup', 180, 180);
    expect(undo()).toBeDisabled();
  });

  it('selects an existing point without modifying it or adding an undo entry', () => {
    renderEditor();
    placeRequiredPoints();
    const point = editor().querySelector('[data-point="nasion"]')!;
    pointer(point, 'pointerdown', 503, 203);
    pointer(editor(), 'pointerup', 503, 203);
    expect(coordinate('Racine du nez', 'X')).toHaveValue(50);
    expect(confirmation()).toBeChecked();
    fireEvent.click(undo());
    selectPoint('Bas du menton');
    expect(coordinate('Bas du menton', 'Y')).toHaveValue(50);
  });

  it('coalesces a point drag into one undo entry and invalidates confirmation', () => {
    renderEditor();
    placeRequiredPoints();
    const point = editor().querySelector('[data-point="nasion"]')!;
    pointer(point, 'pointerdown', 500, 200);
    pointer(editor(), 'pointermove', 510, 210);
    pointer(editor(), 'pointermove', 520, 220);
    pointer(editor(), 'pointerup', 520, 220);
    expect(coordinate('Racine du nez', 'X')).toHaveValue(52);
    expect(coordinate('Racine du nez', 'Y')).toHaveValue(22);
    expect(confirmation()).not.toBeChecked();
    fireEvent.click(undo());
    expect(coordinate('Racine du nez', 'X')).toHaveValue(50);
    expect(coordinate('Racine du nez', 'Y')).toHaveValue(20);
    fireEvent.click(undo());
    selectPoint('Bas du menton');
    expect(coordinate('Bas du menton', 'Y')).toHaveValue(50);
  });

  it('does not retain a drag that ends at its original coordinates', () => {
    renderEditor();
    placeRequiredPoints();
    const point = editor().querySelector('[data-point="nasion"]')!;
    pointer(point, 'pointerdown', 500, 200);
    pointer(editor(), 'pointermove', 520, 220);
    pointer(editor(), 'pointermove', 500, 200);
    pointer(editor(), 'pointerup', 500, 200);
    expect(confirmation()).toBeChecked();
    fireEvent.click(undo());
    selectPoint('Bas du menton');
    expect(coordinate('Bas du menton', 'Y')).toHaveValue(50);
  });

  it('ignores unchanged numeric values and arrows clamped to the image boundary', () => {
    renderEditor();
    fireEvent.change(coordinate('Racine du nez', 'X'), { target: { value: '0' } });
    fireEvent.click(confirmation());
    fireEvent.change(coordinate('Racine du nez', 'X'), { target: { value: '0.0' } });
    fireEvent.change(coordinate('Racine du nez', 'X'), { target: { value: '-5' } });
    fireEvent.keyDown(coordinate('Racine du nez', 'X'), { key: 'ArrowLeft' });
    expect(confirmation()).toBeChecked();
    fireEvent.click(undo());
    expect(coordinate('Racine du nez', 'X')).toHaveValue(null);
    expect(undo()).toBeDisabled();
  });

  it('ignores a click when SVG coordinates are unavailable', () => {
    renderEditor();
    fireEvent.click(confirmation());
    vi.mocked(SVGSVGElement.prototype.getScreenCTM).mockReturnValue(null);
    pointer(editor(), 'pointerdown', 500, 200);
    pointer(editor(), 'pointerup', 500, 200);
    expect(confirmation()).toBeChecked();
    expect(undo()).toBeDisabled();
  });

  it.each(['numeric edit', 'arrow', 'add', 'remove', 'reset', 'side'] as const)(
    'invalidates confirmation after a meaningful %s change',
    (action) => {
      renderEditor();
      placeRequiredPoints();
      if (action === 'numeric edit')
        fireEvent.change(coordinate('Bas du menton', 'X'), { target: { value: '51' } });
      if (action === 'arrow')
        fireEvent.keyDown(coordinate('Bas du menton', 'X'), { key: 'ArrowRight' });
      if (action === 'add') {
        selectPoint('Transition du cou');
        pointer(editor(), 'pointerdown', 400, 900);
        pointer(editor(), 'pointerup', 400, 900);
      }
      if (action === 'remove')
        fireEvent.click(screen.getByRole('button', { name: 'Retirer ce point' }));
      if (action === 'reset')
        fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les points' }));
      if (action === 'side')
        fireEvent.change(screen.getByRole('combobox', { name: 'Côté anatomique observé' }), {
          target: { value: 'left' },
        });
      expect(confirmation()).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Valider et voir le rapport' })).toBeDisabled();
    },
  );
});
