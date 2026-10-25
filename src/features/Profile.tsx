import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeProfile, PROFILE_POINTS } from '../morphometry/profile';
import type { ProfileAnalysis, ProfilePoint, ProfilePointId } from '../types/v2';
import { decodePhoto } from '../vision/photo';
import { LocalNotice } from '../components/Controls';
export interface ProfilePhoto {
  preview: string;
  width: number;
  height: number;
  source: 'import' | 'live-capture';
}
type Points = Partial<Record<ProfilePointId, ProfilePoint>>;
const samePoint = (a?: ProfilePoint, b?: ProfilePoint) =>
  a === b ||
  (!!a &&
    !!b &&
    a.x === b.x &&
    a.y === b.y &&
    a.source === b.source &&
    a.confirmed === b.confirmed);
export default function Profile({
  initial,
  onComplete,
}: {
  initial?: ProfilePhoto;
  onComplete: (profile: ProfileAnalysis) => void;
}) {
  const [photo, setPhoto] = useState<ProfilePhoto | undefined>(initial);
  const [points, setPoints] = useState<Points>({});
  const [history, setHistory] = useState<Points[]>([]);
  const [selected, setSelected] = useState<ProfilePointId>('nasion');
  const [side, setSide] = useState<ProfileAnalysis['side']>('unknown');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    id?: ProfilePointId;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    points?: Points;
    confirmed?: boolean;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = (snapshot = points) => {
    setHistory((h) => [...h.slice(-49), structuredClone(snapshot)]);
    setConfirmed(false);
  };
  const setPoint = (id: ProfilePointId, x: number, y: number, record = true) => {
    const next: ProfilePoint = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      source: 'manual',
      confirmed: true,
    };
    if (samePoint(points[id], next)) return;
    if (record) save();
    setPoints((p) => ({ ...p, [id]: next }));
    setConfirmed(false);
  };
  const finishGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.id || !g.points) return;
    // A gesture creates one undo entry only when its final point differs.
    if (samePoint(g.points[g.id], points[g.id])) setConfirmed(g.confirmed ?? false);
    else save(g.points);
  };
  const load = async (file?: File) => {
    if (!file) return;
    const token = ++epoch.current;
    setBusy(true);
    setError('');
    try {
      const d = await decodePhoto(file);
      try {
        if (!mounted.current || token !== epoch.current) return;
        setPhoto({
          preview: d.preview,
          width: d.bitmap.width,
          height: d.bitmap.height,
          source: 'import',
        });
        setPoints({});
        setHistory([]);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setConfirmed(false);
      } finally {
        d.bitmap.close();
      }
    } catch (e) {
      if (mounted.current && token === epoch.current)
        setError(e instanceof Error ? e.message : 'Image illisible.');
    } finally {
      if (mounted.current && token === epoch.current) setBusy(false);
    }
  };
  const analysis = photo
    ? analyzeProfile({ ...photo, points, side, strictProfileConfirmed: confirmed })
    : null;
  const info = PROFILE_POINTS.find((p) => p.id === selected)!;
  const coordinate = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const matrix = svg.getScreenCTM();
    if (!matrix || !photo) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return {
      x: ((p.x - pan.x - photo.width / 2) / zoom + photo.width / 2) / photo.width,
      y: ((p.y - pan.y - photo.height / 2) / zoom + photo.height / 2) / photo.height,
    };
  };
  return (
    <div className="workspace page-width profile-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROFILE ANALYZER · ASSISTÉ</span>
          <h1>Une nouvelle perspective.</h1>
          <p>Importez un vrai profil, placez les repères visibles et validez leur position.</p>
        </div>
        <Link to="/advanced" className="button secondary">
          Capturer avec la caméra
        </Link>
      </div>
      <LocalNotice />
      <section className="panel">
        <p>
          Les profils stricts ne sont pas automatiquement validés par MediaPipe. Ce parcours utilise
          vos points manuels pour calculer une géométrie 2D réelle. Il ne détecte pas l’anatomie et
          ne mesure pas les os.
        </p>
        <label className="button secondary">
          {photo ? 'Changer la photo de profil' : 'Importer une photo de profil'}
          <input
            type="file"
            aria-label="Importer une photo de profil"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              void load(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {busy && <p role="status">Lecture locale…</p>}
        {error && <p role="alert">{error}</p>}
      </section>
      {photo && (
        <div className="profile-grid">
          <section className="panel profile-editor-panel">
            <div className="profile-tools">
              <label>
                Zoom{' '}
                <input
                  aria-label="Zoom du profil"
                  type="range"
                  min="1"
                  max="5"
                  step=".1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <button
                className="button secondary"
                aria-pressed={panMode}
                onClick={() => setPanMode(!panMode)}
              >
                {panMode ? 'Déplacer la photo' : 'Placer les repères'}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Recentrer
              </button>
            </div>
            <svg
              ref={svgRef}
              className="profile-editor"
              viewBox={`0 0 ${photo.width} ${photo.height}`}
              role="img"
              aria-label="Photo de profil et repères manuels"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                svgRef.current?.setPointerCapture(e.pointerId);
                const id = (e.target as SVGElement).dataset.point as ProfilePointId | undefined;
                if (panMode) {
                  gesture.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    panX: pan.x,
                    panY: pan.y,
                  };
                  return;
                }
                const p = coordinate(e.clientX, e.clientY);
                if (!p) return;
                const active = id ?? selected;
                setSelected(active);
                gesture.current = {
                  id: active,
                  startX: e.clientX,
                  startY: e.clientY,
                  panX: pan.x,
                  panY: pan.y,
                  points,
                  confirmed,
                };
                if (!id) setPoint(active, p.x, p.y, false);
              }}
              onPointerMove={(e) => {
                const g = gesture.current;
                if (!g) return;
                if (g.id) {
                  const p = coordinate(e.clientX, e.clientY);
                  if (p) setPoint(g.id, p.x, p.y, false);
                } else {
                  const inverse = svgRef.current!.getScreenCTM()?.inverse();
                  if (!inverse) return;
                  const start = new DOMPoint(g.startX, g.startY).matrixTransform(inverse);
                  const current = new DOMPoint(e.clientX, e.clientY).matrixTransform(inverse);
                  setPan({ x: g.panX + current.x - start.x, y: g.panY + current.y - start.y });
                }
              }}
              onPointerUp={finishGesture}
              onPointerCancel={finishGesture}
            >
              <defs>
                <clipPath id="profile-clip">
                  <rect width={photo.width} height={photo.height} />
                </clipPath>
              </defs>
              <g clipPath="url(#profile-clip)">
                <g
                  transform={`translate(${pan.x + photo.width / 2} ${pan.y + photo.height / 2}) scale(${zoom}) translate(${-photo.width / 2} ${-photo.height / 2})`}
                >
                  <image href={photo.preview} width={photo.width} height={photo.height} />
                  <polyline
                    points={PROFILE_POINTS.filter((p) => points[p.id])
                      .map(
                        (p) => `${points[p.id]!.x * photo.width},${points[p.id]!.y * photo.height}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke="#56e0cf"
                    strokeWidth={Math.max(photo.width / 300, 1) / zoom}
                    pointerEvents="none"
                  />
                  {(['nasion', 'menton', 'pronasale', 'pogonion'] as const).every(
                    (id) => points[id],
                  ) && (
                    <>
                      <line
                        x1={points.nasion!.x * photo.width}
                        y1={points.nasion!.y * photo.height}
                        x2={points.menton!.x * photo.width}
                        y2={points.menton!.y * photo.height}
                        stroke="#ffd28a"
                        strokeDasharray="8 6"
                        strokeWidth={2 / zoom}
                      />
                      <line
                        x1={points.pronasale!.x * photo.width}
                        y1={points.pronasale!.y * photo.height}
                        x2={points.pogonion!.x * photo.width}
                        y2={points.pogonion!.y * photo.height}
                        stroke="#b6a9ff"
                        strokeDasharray="8 6"
                        strokeWidth={2 / zoom}
                      />
                    </>
                  )}
                  {PROFILE_POINTS.map((p, i) => {
                    const pt = points[p.id];
                    return pt ? (
                      <g key={p.id}>
                        <circle
                          data-point={p.id}
                          cx={pt.x * photo.width}
                          cy={pt.y * photo.height}
                          r={Math.max(photo.width / 42, 7) / zoom}
                          fill={selected === p.id ? '#ffffff' : '#56e0cf'}
                          fillOpacity=".8"
                          stroke="#10212b"
                          strokeWidth={2 / zoom}
                        />
                        <text
                          x={pt.x * photo.width}
                          y={pt.y * photo.height}
                          fontSize={Math.max(photo.width / 55, 8) / zoom}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#06121c"
                          pointerEvents="none"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ) : null;
                  })}
                </g>
              </g>
            </svg>
            <p className="small muted">
              Contour : points placés uniquement. Tirets jaunes : référence N–Me. Tirets violets :
              ligne nez–menton. Glissez un point pour le déplacer. En mode « Déplacer la photo »,
              glissez pour parcourir l’image agrandie.
            </p>
            <div className="profile-tools">
              <button
                className="button secondary"
                disabled={!history.length}
                onClick={() => {
                  setPoints(history.at(-1)!);
                  setHistory(history.slice(0, -1));
                  setConfirmed(false);
                }}
              >
                Annuler
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  if (!Object.keys(points).length) return;
                  save();
                  setPoints({});
                }}
              >
                Réinitialiser les points
              </button>
            </div>
          </section>
          <aside className="panel profile-controls">
            <label className="select-label">
              Côté anatomique observé
              <select
                value={side}
                onChange={(e) => {
                  if (e.target.value === side) return;
                  setSide(e.target.value as ProfileAnalysis['side']);
                  setConfirmed(false);
                }}
              >
                <option value="unknown">Je ne sais pas / image peut-être inversée</option>
                <option value="left">Profil gauche de la personne</option>
                <option value="right">Profil droit de la personne</option>
              </select>
            </label>
            <p className="small muted">
              Le sens du nez dans l’image ne suffit pas à connaître le côté anatomique, notamment
              après un miroir.
            </p>
            <ol className="profile-point-list">
              {PROFILE_POINTS.map((p, i) => (
                <li key={p.id}>
                  <button
                    className="button secondary"
                    aria-pressed={p.id === selected}
                    onClick={() => setSelected(p.id)}
                  >
                    {i + 1}. {p.name} {points[p.id] ? '✓' : p.required ? '*' : '(facultatif)'}
                  </button>
                </li>
              ))}
            </ol>
            <h3>{info.name}</h3>
            <p>{info.help}</p>
            <p className="small">* Repère nécessaire. Origine : placement manuel.</p>
            <div className="profile-coordinates">
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()} (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step=".1"
                    aria-label={`${info.name} ${axis.toUpperCase()} (%)`}
                    value={
                      points[selected] ? Number((points[selected]![axis] * 100).toFixed(2)) : ''
                    }
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      const old = points[selected] ?? { x: 0.5, y: 0.5 };
                      setPoint(
                        selected,
                        axis === 'x' ? Number(e.target.value) / 100 : old.x,
                        axis === 'y' ? Number(e.target.value) / 100 : old.y,
                      );
                    }}
                    onKeyDown={(e) => {
                      if (
                        !points[selected] ||
                        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                      )
                        return;
                      e.preventDefault();
                      const p = points[selected]!;
                      const step = (e.shiftKey ? 10 : 1) / Math.max(photo.width, photo.height);
                      setPoint(
                        selected,
                        p.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
                        p.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
                      );
                    }}
                  />
                </label>
              ))}
            </div>
            {points[selected] && (
              <button
                className="text-link"
                onClick={() => {
                  save();
                  setPoints((p) => {
                    const next = { ...p };
                    delete next[selected];
                    return next;
                  });
                }}
              >
                Retirer ce point
              </button>
            )}
            <p className="small muted">
              Flèches dans les coordonnées : déplacement d’environ 1 pixel; Maj : 10 pixels.
            </p>
            <label className="profile-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Je confirme une vue latérale de profil strict (environ 90°), un seul visage, et le
              placement des repères sur son contour visible.
            </label>
            <p role="status">
              {analysis?.quality.valid
                ? `${analysis.measurements.filter((m) => m.value !== null).length} mesures disponibles · fiabilité limitée`
                : 'Placez les 5 repères nécessaires, puis confirmez le placement.'}
            </p>
            <button
              className="button primary full"
              disabled={busy || !analysis?.quality.valid}
              onClick={() => {
                if (!busy && analysis?.quality.valid) onComplete(analysis);
              }}
            >
              Valider et voir le rapport
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
