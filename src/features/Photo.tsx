import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, ArrowRight, ImagePlus, Check, RotateCcw } from 'lucide-react';
import type { AggregatedAnalysis, CaptureQuality, FaceDetectionResult, Region } from '../types';
import { decodePhoto } from '../vision/photo';
import { visionClient } from '../vision/client';
import { assessQuality } from '../vision/quality';
import { aggregate } from '../vision/temporal';
import { measure } from '../morphometry/metrics';
import { Mesh, type Layer } from '../components/Mesh';
import { LayerControls, Loading, LocalNotice } from '../components/Controls';

export function Photo({ onReport }: { onReport: (r: AggregatedAnalysis) => void }) {
  const [preview, setPreview] = useState('');
  const [profile, setProfile] = useState('');
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  const [quality, setQuality] = useState<CaptureQuality | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [layer, setLayer] = useState<Layer>('mesh');
  const [region, setRegion] = useState<Region>('all');
  const [dragging, setDragging] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const load = async (file?: File, isProfile = false) => {
    if (!file || busy) return;
    const token = ++generation.current;
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
        setProfile(decoded.preview);
        return;
      }
      setPreview(decoded.preview);
      setMessage('Chargement du modèle et détection locale…');
      const detection = await visionClient.detect(bitmap, 'IMAGE', performance.now());
      if (token !== generation.current) return;
      const q = assessQuality(detection, detection.pixels ?? null);
      setResult(detection);
      setQuality(q);
      if (!q.valid || !q.frontal)
        setError(
          q.issues.length
            ? q.issues.join(' ')
            : 'Choisissez une photo de face : rotation et inclinaison inférieures à 12°.',
        );
    } catch (e) {
      if (token === generation.current)
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
    if (!result || !quality?.valid || !quality.frontal) return;
    const analysis = aggregate(
      [{ detection: result, quality, measurements: measure(result, quality), stage: 'front' }],
      'photo',
    );
    onReport({ ...analysis, preview, profileProvided: Boolean(profile) });
  };
  const reset = () => {
    generation.current++;
    setPreview('');
    setProfile('');
    setResult(null);
    setQuality(null);
    setError('');
    setBusy(false);
  };
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
                <Mesh result={result} layer={layer} region={region} />
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
          {result && (
            <LayerControls layer={layer} onLayer={setLayer} region={region} onRegion={setRegion} />
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
            <h3>Gardez une vue de contexte.</h3>
            <p className="small muted">
              Vous pouvez importer un profil. La V1 ne mesure pas sa projection et ne l’utilise pas
              pour le score.
            </p>
            {profile && (
              <img
                className="profile-preview"
                src={profile}
                alt="Profil facultatif conservé en mémoire"
              />
            )}
            <label className="button secondary full">
              <ImagePlus size={16} />
              {profile ? 'Changer le profil' : 'Ajouter un profil'}
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
            {profile && (
              <button className="text-link" onClick={() => setProfile('')}>
                Retirer le profil
              </button>
            )}
          </section>
          <button
            className="button primary full"
            disabled={busy || !quality?.valid || !quality.frontal}
            onClick={report}
          >
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
