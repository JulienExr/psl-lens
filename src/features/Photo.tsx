import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, ArrowRight, ImagePlus, Check, RotateCcw } from 'lucide-react';
import type { AggregatedAnalysis, CaptureQuality, FaceDetectionResult, Region } from '../types';
import type { ProfilePhoto } from './Profile';
import { decodePhoto } from '../vision/photo';
import { visionClient } from '../vision/client';
import { assessQuality } from '../vision/quality';
import { aggregate } from '../vision/temporal';
import { definitions, measure } from '../morphometry/metrics';
import { Mesh, type Layer } from '../components/Mesh';
import { LayerControls, Loading, LocalNotice } from '../components/Controls';
import { isVisionCancellation } from '../vision/cancellation';

export function Photo({
  onReport,
  onProfile,
}: {
  onReport: (r: AggregatedAnalysis) => void;
  onProfile: (photo: ProfilePhoto, frontal?: AggregatedAnalysis) => void;
}) {
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  const [quality, setQuality] = useState<CaptureQuality | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [layer, setLayer] = useState<Layer>('mesh');
  const [region, setRegion] = useState<Region>('all');
  const [measurementId, setMeasurementId] = useState('face-ratio');
  const [dragging, setDragging] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const load = async (file?: File, isProfile = false) => {
    if (!file || busy) return;
    const token = ++generation.current;
    const session = new AbortController();
    controller.current = session;
    setBusy(true);
    setError('');
    setMessage('Vérification de l’image…');
    if (!isProfile) {
      setResult(null);
      setQuality(null);
      setPreview('');
    }
    let bitmap: ImageBitmap | undefined;
    try {
      const decoded = await decodePhoto(file);
      bitmap = decoded.bitmap;
      if (token !== generation.current) return;
      if (isProfile) {
        const frontal =
          result &&
          quality &&
          measure(result, quality, { allowApproximate: true }).some((m) => m.value !== null)
            ? {
                ...aggregate(
                  [
                    {
                      detection: result,
                      quality,
                      measurements: measure(result, quality, { allowApproximate: true }),
                      stage: 'front',
                    },
                  ],
                  'photo',
                ),
                preview,
              }
            : undefined;
        onProfile(
          {
            preview: decoded.preview,
            width: bitmap.width,
            height: bitmap.height,
            source: 'import',
          },
          frontal,
        );
        return;
      }
      setPreview(decoded.preview);
      setMessage('Chargement du modèle et détection locale…');
      const detection = await visionClient.detect(
        bitmap,
        'IMAGE',
        performance.now(),
        session.signal,
      );
      if (token !== generation.current) return;
      const q = assessQuality(detection, detection.pixels ?? null);
      setResult(detection);
      setQuality(q);
      if (!measure(detection, q, { allowApproximate: true }).some((m) => m.value !== null))
        setError(
          q.issues.length
            ? q.issues.join(' ')
            : 'Choisissez une photo de face : rotation et inclinaison inférieures à 12°.',
        );
    } catch (e) {
      if (token === generation.current && !isVisionCancellation(e))
        setError(e instanceof Error ? e.message : 'Impossible de lire cette image.');
    } finally {
      bitmap?.close();
      if (token === generation.current) {
        setBusy(false);
        setMessage('');
      }
    }
  };
  const report = () => {
    if (
      !result ||
      !quality ||
      !measure(result, quality, { allowApproximate: true }).some((m) => m.value !== null)
    )
      return;
    const analysis = aggregate(
      [
        {
          detection: result,
          quality,
          measurements: measure(result, quality, { allowApproximate: true }),
          stage: 'front',
        },
      ],
      'photo',
    );
    onReport({ ...analysis, preview });
  };
  const reset = () => {
    generation.current++;
    setPreview('');
    setResult(null);
    setQuality(null);
    setError('');
    setBusy(false);
  };
  const canReport = Boolean(
    result &&
    quality &&
    measure(result, quality, { allowApproximate: true }).some((m) => m.value !== null),
  );
  return (
    <div className="workspace page-width">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNE IMAGE. UNE NOUVELLE PERSPECTIVE.</span>
          <h1>Votre photo, décryptée.</h1>
          <p>Une vue frontale, un éclairage naturel. Le reste se passe ici, localement.</p>
        </div>
        <Link to="/live" className="button secondary compact">
          Passer en Live <ArrowRight size={16} />
        </Link>
      </div>
      <LocalNotice />
      <div className="studio-grid">
        <section className="panel photo-panel">
          <div className="panel-top">
            <span className="mono">01 / PHOTO FRONTALE</span>
            <span className="mono">JPG · PNG · WEBP</span>
          </div>
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-photo' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void load(e.dataTransfer.files[0]);
            }}
          >
            {preview ? (
              <div
                className="photo-coordinate"
                style={
                  result
                    ? {
                        aspectRatio: `${result.width}/${result.height}`,
                        maxWidth: `${(700 * result.width) / result.height}px`,
                      }
                    : undefined
                }
              >
                <img src={preview} alt="Votre photo frontale, conservée en mémoire" />
                <Mesh result={result} layer={layer} region={region} measurementId={measurementId} />
              </div>
            ) : (
              <div className="upload-empty">
                <div className="upload-icon">
                  <Upload size={30} strokeWidth={1.4} />
                </div>
                <h2>Tout commence par une photo.</h2>
                <p>
                  Glissez votre image ici, ou choisissez un fichier.
                  <br />
                  Un seul visage adulte, de face, sans filtre.
                </p>
              </div>
            )}
            <label className={`button ${preview ? 'secondary' : 'primary'} upload-label`}>
              <ImagePlus size={18} />
              {preview ? 'Changer de photo' : 'Choisir une photo'}
              <input
                aria-label="Photo de face"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void load(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {!preview && (
              <span className="small muted">256 px minimum · 20 Mo maximum · 48 MP maximum</span>
            )}
          </div>
          {busy && <Loading>{message}</Loading>}
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          {canReport && quality && (!quality.valid || !quality.frontal) && (
            <div role="status" className="capture-warning">
              <strong>Estimation disponible · capture à améliorer</strong>
              <p>
                {quality.issues.join(' ') || 'Une vue de face améliorera la fiabilité.'} Le score
                reste accessible avec un avertissement.
              </p>
            </div>
          )}
          {result && (
            <LayerControls
              layer={layer}
              onLayer={setLayer}
              region={region}
              onRegion={(next) => {
                setRegion(next);
                setMeasurementId(definitions.find((m) => next === 'all' || m.region === next)!.id);
              }}
            />
          )}
          {result && layer === 'measurements' && (
            <div className="measurement-selector">
              <label className="select-label">
                Construction géométrique
                <select value={measurementId} onChange={(e) => setMeasurementId(e.target.value)}>
                  {definitions
                    .filter((m) => region === 'all' || m.region === region)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              <p>{definitions.find((m) => m.id === measurementId)?.formula}</p>
            </div>
          )}
          {quality?.valid && quality.frontal && (
            <div role="status" className="success-message">
              <Check size={17} />
              Capture frontale exploitable. 15 mesures disponibles.
            </div>
          )}
        </section>
        <aside className="studio-sidebar">
          <section className="panel">
            <span className="eyebrow">LES BONS RÉFLEXES</span>
            <h2>Une capture qui fait la différence.</h2>
            <ol className="photo-tips">
              <li>
                <span>01</span>
                <div>
                  <strong>Regardez l’objectif</strong>
                  <p>Gardez la tête droite, les yeux ouverts et une expression neutre.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Privilégiez une lumière douce</strong>
                  <p>Évitez les ombres marquées et les zones surexposées.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Laissez de la distance</strong>
                  <p>Un recul suffisant réduit la déformation d’un selfie grand-angle.</p>
                </div>
              </li>
            </ol>
          </section>
          <section className="panel profile-panel">
            <span className="eyebrow">OPTIONNEL / VUE DE PROFIL</span>
            <h3>Mesurez un vrai profil.</h3>
            <p className="small muted">
              Placement assisté des repères visibles, puis mesures latérales dans le même rapport.
              Si la face est prête, elle est conservée.
            </p>
            <label className="button secondary full">
              <ImagePlus size={16} />
              Ajouter un profil
              <input
                aria-label="Photo de profil facultative"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void load(e.target.files?.[0], true);
                  e.target.value = '';
                }}
              />
            </label>
            <Link className="text-link" to="/profile">
              Analyser un profil seul
            </Link>
          </section>
          <button className="button primary full" disabled={busy || !canReport} onClick={report}>
            Découvrir mon rapport
            <ArrowRight size={18} />
          </button>
          {preview && (
            <button className="button secondary full" onClick={reset} disabled={busy}>
              <RotateCcw size={16} />
              Recommencer
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
