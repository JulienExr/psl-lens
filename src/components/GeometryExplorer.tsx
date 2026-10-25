import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { FaceDetectionResult } from '../types';
import connections from '../vision/connections.json';
import {
  normalizeFaceGeometry,
  projectGeometry,
  type ExplorerCamera,
} from '../vision/explorer-geometry';

const initialCamera: ExplorerCamera = { yaw: 0, pitch: 0, zoom: 1 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const visualStyle = {
  width: '100%',
  aspectRatio: '4 / 3',
  display: 'block',
  color: 'var(--accent, #6ae7d7)',
  background: 'var(--surface, #111a29)',
  borderRadius: 12,
};

/** Mount only after an explicit request; this component performs no model loading. */
export default function GeometryExplorer({ result }: { result: FaceDetectionResult | null }) {
  const id = useId();
  const points = useMemo(() => normalizeFaceGeometry(result), [result]);
  const [camera, setCamera] = useState(initialCamera);
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [layer, setLayer] = useState('wireframe');
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const flat = mode === '2d' || canvasUnavailable;
  const projected = useMemo(
    () => projectGeometry(points ?? [], 640, 480, camera, true),
    [points, camera],
  );
  const draw = useCallback(() => {
    const element = canvas.current;
    if (!element || !points || flat) return;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = element.getContext('2d');
    } catch {
      /* Fall back to SVG. */
    }
    if (!context) {
      setCanvasUnavailable(true);
      return;
    }
    const bounds = element.getBoundingClientRect();
    const width = bounds.width > 0 ? bounds.width : 640;
    const height = bounds.height > 0 ? bounds.height : 480;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const color = getComputedStyle(element).color || '#6ae7d7';
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 0.7;
    const scene = projectGeometry(points, width, height, camera);
    if (layer !== 'points') {
      context.beginPath();
      for (const { start, end } of connections.TESSELATION) {
        const a = scene[start],
          b = scene[end];
        if (!a || !b) continue;
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
    }
    if (layer !== 'wireframe') {
      context.beginPath();
      for (const p of scene) {
        if (!p) continue;
        context.moveTo(p.x + 1.7, p.y);
        context.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
      }
      context.fill();
    }
  }, [points, flat, camera, layer]);

  useEffect(() => {
    draw();
    const element = canvas.current;
    if (!element || flat) return;
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(draw);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw, flat]);

  const endPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const movePointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    if (before.length >= 2) {
      const distance = (pair: { x: number; y: number }[]) =>
        Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const oldDistance = distance(before);
      if (oldDistance > 0)
        setCamera((c) => ({ ...c, zoom: clamp((c.zoom * distance(after)) / oldDistance, 0.5, 2) }));
    } else {
      setCamera((c) => ({
        ...c,
        yaw: clamp(c.yaw + (event.clientX - previous.x) * 0.5, -180, 180),
        pitch: clamp(c.pitch - (event.clientY - previous.y) * 0.5, -85, 85),
      }));
    }
  };

  return (
    <section className="geometry-explorer" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Géométrie faciale relative estimée</h3>
      <p id={`${id}-limits`} className="small">
        Repères et profondeur relative estimés par MediaPipe : ni un scan anatomique ni une mesure
        métrique. La rotation explore cette estimation et ne reconstitue pas les parties cachées du
        visage.
      </p>
      {!points ? (
        <p role="status">
          Une détection unique avec des repères valides est nécessaire pour ouvrir cette vue.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className="button secondary compact"
              aria-pressed={!flat}
              disabled={canvasUnavailable}
              onClick={() => setMode('3d')}
            >
              Vue estimée 3D
            </button>
            <button
              type="button"
              className="button secondary compact"
              aria-pressed={flat}
              onClick={() => {
                pointers.current.clear();
                setMode('2d');
              }}
            >
              Vue plane 2D
            </button>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => {
                pointers.current.clear();
                setCamera(initialCamera);
              }}
            >
              Réinitialiser la vue
            </button>
          </div>
          <p role="status" className="small">
            {flat
              ? canvasUnavailable
                ? 'Canvas2D indisponible : vue plane 2D de secours.'
                : 'Vue plane 2D — repères dans le plan de l’image.'
              : camera.yaw === 0 && camera.pitch === 0
                ? 'Vue initiale — orientation canonique de la caméra, sans correction anatomique.'
                : 'Vue estimée tournée — profondeur relative.'}
          </p>
          {flat ? (
            <svg
              style={visualStyle}
              viewBox="0 0 640 480"
              role="img"
              aria-label="Géométrie relative estimée, vue plane 2D"
              aria-describedby={`${id}-limits`}
            >
              {layer !== 'points' && (
                <path
                  d={connections.TESSELATION.flatMap(({ start, end }) => {
                    const a = projected[start],
                      b = projected[end];
                    return a && b ? [`M${a.x},${a.y}L${b.x},${b.y}`] : [];
                  }).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                />
              )}
              {layer !== 'wireframe' &&
                projected.map(
                  (p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="1.7" fill="currentColor" />,
                )}
            </svg>
          ) : (
            <canvas
              ref={canvas}
              style={{ ...visualStyle, touchAction: 'none', cursor: 'grab' }}
              role="img"
              aria-label="Géométrie relative estimée, vue interactive 3D"
              aria-describedby={`${id}-limits ${id}-help`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
            />
          )}
          <p id={`${id}-help`} className="small muted">
            Glisser pour tourner, pincer avec deux doigts pour zoomer. Les curseurs offrent les
            mêmes commandes au clavier. Réinitialiser remet uniquement l’orientation de la caméra et
            le zoom.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <label className="small">
              Rotation horizontale <output>{camera.yaw.toFixed(0)}°</output>
              <input
                aria-label="Rotation horizontale"
                style={{ display: 'block', width: '100%' }}
                type="range"
                min="-180"
                max="180"
                step="1"
                value={camera.yaw}
                disabled={flat}
                onChange={(e) => setCamera((c) => ({ ...c, yaw: Number(e.target.value) }))}
              />
            </label>
            <label className="small">
              Rotation verticale <output>{camera.pitch.toFixed(0)}°</output>
              <input
                aria-label="Rotation verticale"
                style={{ display: 'block', width: '100%' }}
                type="range"
                min="-85"
                max="85"
                step="1"
                value={camera.pitch}
                disabled={flat}
                onChange={(e) => setCamera((c) => ({ ...c, pitch: Number(e.target.value) }))}
              />
            </label>
            <label className="small">
              Zoom <output>{camera.zoom.toFixed(2)}×</output>
              <input
                aria-label="Zoom"
                style={{ display: 'block', width: '100%' }}
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                value={camera.zoom}
                onChange={(e) => setCamera((c) => ({ ...c, zoom: Number(e.target.value) }))}
              />
            </label>
            <label className="small">
              Afficher{' '}
              <select
                aria-label="Afficher"
                value={layer}
                onChange={(e) => setLayer(e.target.value)}
                style={{
                  display: 'block',
                  padding: 8,
                  borderRadius: 6,
                  background: 'var(--surface, #111a29)',
                }}
              >
                <option value="wireframe">Maillage</option>
                <option value="points">Points</option>
                <option value="both">Points et maillage</option>
              </select>
            </label>
          </div>
        </>
      )}
    </section>
  );
}
