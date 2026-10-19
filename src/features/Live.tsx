import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  Pause,
  Play,
  FlipHorizontal2,
  ArrowRight,
  RotateCcw,
  ScanFace,
  Check,
  Info,
} from 'lucide-react';
import type { AggregatedAnalysis, Region, ScanObservation, ScanMode } from '../types';
import { useCamera } from '../hooks/useCamera';
import type { Layer } from '../components/Mesh';
import { LiveMesh, type LiveMeshHandle } from '../components/LiveMesh';
import { LayerControls, LocalNotice, Loading } from '../components/Controls';
import { advanceScan, initialScan, getScanStages } from '../vision/scan';
import { aggregate } from '../vision/temporal';
import { visionClient } from '../vision/client';
import { definitions, measure } from '../morphometry/metrics';

export function Live({
  guided = false,
  onReport,
}: {
  guided?: boolean;
  onReport: (r: AggregatedAnalysis) => void;
}) {
  const [layer, setLayer] = useState<Layer>('mesh');
  const [region, setRegion] = useState<Region>('all');
  const [mirrored, setMirrored] = useState(true);
  const [measurementId, setMeasurementId] = useState('face-ratio');
  const meshRef = useRef<LiveMeshHandle>(null);
  const captureIssues = useRef(new Set<string>());
  const timing = useRef<{ at: number; render: number; latency: number }[]>([]);
  const lastStats = useRef(0);
  const [stats, setStats] = useState({ frequency: 0, render: 0, latency: 0 });
  const [scan, setScan] = useState(initialScan);
  const scanRef = useRef(initialScan());
  const observations = useRef<ScanObservation[]>([]);
  const [count, setCount] = useState(0);
  const observe = useCallback(
    (observation: ScanObservation) => {
      const render = meshRef.current?.draw(observation.detection) ?? 0;
      timing.current = [
        ...timing.current.slice(-29),
        { at: observation.detection.timestamp, render, latency: observation.detection.inferenceMs },
      ];
      if (performance.now() - lastStats.current > 500) {
        const values = timing.current;
        setStats({
          frequency:
            values.length > 1
              ? ((values.length - 1) * 1000) / (values.at(-1)!.at - values[0].at)
              : 0,
          render: values.reduce((s, v) => s + v.render, 0) / values.length,
          latency: values.reduce((s, v) => s + v.latency, 0) / values.length,
        });
        lastStats.current = performance.now();
      }
      observation.quality.issues.forEach((issue) => captureIssues.current.add(issue));
      if (guided) {
        const next = advanceScan(scanRef.current, observation);
        scanRef.current = next;
        setScan(next);
        if (next.complete)
          onReport(
            aggregate(next.observations, 'guided', next.rejected, {
              scanMode: next.mode,
              captureIssues: [...captureIssues.current],
            }),
          );
      } else if (observation.quality.valid && observation.quality.frontal) {
        observations.current = [...observations.current.slice(-59), observation];
        setCount(observations.current.length);
      }
    },
    [guided, onReport],
  );
  const { videoRef, ...camera } = useCamera(observe);
  useEffect(() => {
    if (!camera.detection) meshRef.current?.draw(null);
  }, [camera.detection]);
  const reset = () => {
    scanRef.current = initialScan(scanRef.current.mode);
    setScan(scanRef.current);
    observations.current = [];
    setCount(0);
    captureIssues.current.clear();
    timing.current = [];
    setStats({ frequency: 0, render: 0, latency: 0 });
    meshRef.current?.draw(null);
  };
  const selectScanMode = (mode: ScanMode) => {
    scanRef.current = initialScan(mode);
    reset();
  };
  const start = (id?: string) => {
    reset();
    void camera.start(id);
  };
  const stages = getScanStages(scan.mode);
  const stage = stages[Math.min(scan.stageIndex, stages.length - 1)];
  const active = camera.status === 'active';
  const busy = camera.status === 'starting' || camera.status === 'loading';
  const metrics =
    camera.detection && camera.quality ? measure(camera.detection, camera.quality) : [];
  const progress = guided
    ? Math.round((scan.observations.length / stages.reduce((sum, s) => sum + s.required, 0)) * 100)
    : 0;
  const selectedMeasurement = definitions.find((m) => m.id === measurementId);
  return (
    <div className="page-width workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {guided ? 'ACQUISITION MULTI-ANGLES' : 'VOTRE LABORATOIRE PERSONNEL'}
          </span>
          <h1>
            {guided ? 'Un scan. Plusieurs perspectives.' : 'Le studio Live.'}
            <span className="heading-dot">●</span>
          </h1>
          <p>
            {guided
              ? 'Une capture frontale stabilisée. Des vues supplémentaires facultatives pour vérifier la continuité.'
              : 'Votre visage en mouvement. Vos proportions, en perspective.'}
          </p>
        </div>
        <Link className="button secondary compact" to={guided ? '/live' : '/scan'}>
          {guided ? <Camera size={17} /> : <ScanFace size={17} />}{' '}
          {guided ? 'Mode libre' : 'Scan guidé'}
          <ArrowRight size={16} />
        </Link>
      </div>
      <LocalNotice />
      <div className="studio-grid">
        <section className="camera-panel">
          <div className="panel-top">
            <span className="mono">
              <span className={`status-dot ${active ? '' : 'off'}`} />
              {active
                ? camera.paused
                  ? ' ANALYSE EN PAUSE'
                  : ' CAMÉRA ACTIVE'
                : ' CAMÉRA EN ATTENTE'}
            </span>
            <span className="mono">
              {camera.detection
                ? `${camera.detection.inferenceMs.toFixed(0)} MS / INFÉRENCE`
                : 'LOCAL VISION ENGINE'}
            </span>
          </div>
          <div
            className={`camera-stage ${active || busy ? 'has-video' : ''}`}
            style={
              camera.detection
                ? { aspectRatio: `${camera.detection.width}/${camera.detection.height}` }
                : undefined
            }
          >
            <div className={`media-coordinate ${mirrored ? 'mirrored' : ''}`}>
              <video ref={videoRef} playsInline muted aria-label="Flux de votre caméra" />
              <LiveMesh ref={meshRef} layer={layer} region={region} measurementId={measurementId} />
            </div>
            {!active && !busy && (
              <div className="camera-empty">
                <div className="camera-placeholder">
                  <ScanFace size={55} strokeWidth={1} />
                </div>
                <h2>Entrez dans le cadre.</h2>
                <p>
                  Votre caméra ne s’active qu’avec votre accord.
                  <br />
                  Aucune image n’est envoyée ou enregistrée.
                </p>
                <button className="button primary" onClick={() => start()}>
                  <Camera size={18} />
                  Activer la caméra
                </button>
                <Link to="/photo" className="text-link">
                  Ou importer une photo <ArrowRight size={14} />
                </Link>
              </div>
            )}
            {busy && (
              <div className="camera-loading">
                <Loading>
                  {camera.status === 'starting'
                    ? 'Connexion à la caméra…'
                    : 'Chargement du moteur local…'}
                </Loading>
                <p>Le modèle et le moteur WASM sont servis par ce site.</p>
                <button className="button secondary compact" onClick={camera.stop}>
                  Annuler
                </button>
              </div>
            )}
            {active && (
              <>
                <div className="face-guide" aria-hidden="true" />
                <div className="capture-label">
                  <span className={`status-dot ${camera.quality?.valid ? '' : 'warning'}`} />
                  {camera.detection?.faces.length === 1
                    ? 'Visage détecté'
                    : camera.detection?.faces.length
                      ? 'Plusieurs visages'
                      : 'Recherche du visage'}
                </div>
                {camera.paused && (
                  <div className="pause-label">
                    <Pause size={18} />
                    Analyse en pause · caméra active
                  </div>
                )}
              </>
            )}
          </div>
          <div className="camera-toolbar">
            <div className="toolbar-group">
              <button
                className="icon-button"
                disabled={!active}
                onClick={camera.togglePause}
                aria-label={camera.paused ? 'Reprendre l’analyse' : 'Mettre en pause'}
              >
                {camera.paused ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <button
                className="icon-button"
                disabled={!active}
                onClick={() => setMirrored(!mirrored)}
                aria-label="Basculer le miroir"
                aria-pressed={mirrored}
              >
                <FlipHorizontal2 size={18} />
              </button>
              <span className="toolbar-divider" />
              <span className="mono muted">{active ? visionClient.modeLabel : 'CAMERA OFF'}</span>
            </div>
            <button
              className="button danger compact"
              disabled={camera.status === 'off'}
              onClick={camera.stop}
            >
              <CameraOff size={16} />
              Arrêter
            </button>
          </div>
          {camera.devices.length > 0 && (
            <label className="select-label camera-select">
              Caméra
              <select
                value={camera.deviceId}
                disabled={busy}
                onChange={(e) => start(e.target.value)}
              >
                {camera.devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Caméra ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <LayerControls
            layer={layer}
            onLayer={setLayer}
            region={region}
            onRegion={(next) => {
              setRegion(next);
              setMeasurementId(definitions.find((m) => next === 'all' || m.region === next)!.id);
            }}
          />
          {layer === 'measurements' && (
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
              <p className="small muted">
                {selectedMeasurement?.formula}. La mesure reste descriptive; une vue frontale valide
                est requise.
              </p>
            </div>
          )}
          {active && (
            <div className="performance-readout mono">
              <span>{stats.frequency ? stats.frequency.toFixed(1) : '—'} INFÉRENCES/S</span>
              <span>{stats.latency.toFixed(1)} MS LATENCE</span>
              <span>{stats.render.toFixed(2)} MS DESSIN CANVAS</span>
            </div>
          )}
          {camera.error && (
            <div className="error-message" role="alert">
              {camera.error}
              <Link to="/photo" className="text-link">
                Analyser une photo <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <aside className="studio-sidebar">
          {guided ? (
            <section className="panel scan-panel">
              <div className="scan-mode-choice" role="group" aria-label="Protocole du scan">
                <button
                  aria-pressed={scan.mode === 'quick'}
                  onClick={() => selectScanMode('quick')}
                >
                  Quick Scan
                </button>
                <button
                  aria-pressed={scan.mode === 'multi-angle'}
                  onClick={() => selectScanMode('multi-angle')}
                >
                  Multi-Angle Scan
                </button>
              </div>
              <p className="small muted">
                {scan.mode === 'quick'
                  ? '16 observations de face. Aucun contrôle oblique requis.'
                  : 'Les rotations contrôlent la continuité géométrique. Elles ne reconstruisent pas le visage et ne corrigent pas les ratios frontaux.'}
              </p>
              <div className="eyebrow">
                SCAN GUIDÉ <span className="mono">{progress}%</span>
              </div>
              <h2>{stage.title}</h2>
              <p>{stage.instruction}</p>
              <div className="pose-guide" aria-label={`Rotation cible ${stage.targetYaw} degrés`}>
                <ScanFace
                  size={64}
                  strokeWidth={1}
                  style={{ transform: `perspective(200px) rotateY(${stage.targetYaw}deg)` }}
                />
                <span className="mono">
                  {stage.id === 'front'
                    ? 'FACE'
                    : stage.id === 'left'
                      ? 'VOTRE GAUCHE'
                      : 'VOTRE DROITE'}
                </span>
              </div>
              <progress
                max={stage.required}
                value={scan.accepted}
                aria-label="Observations valides de l’étape"
              />
              <p className="mono small">
                {scan.accepted} / {stage.required} OBSERVATIONS CONSÉCUTIVES
              </p>
              <ol className="scan-steps">
                {stages.map((s, i) => (
                  <li
                    key={s.id}
                    className={
                      i === scan.stageIndex ? 'current' : i < scan.stageIndex ? 'done' : ''
                    }
                  >
                    <span>{i < scan.stageIndex ? <Check size={13} /> : `0${i + 1}`}</span>
                    {s.id === 'front'
                      ? 'Positionnement & capture frontale'
                      : s.id === 'left'
                        ? 'Rotation gauche'
                        : 'Rotation droite'}
                  </li>
                ))}
              </ol>
              <button className="button secondary full" onClick={reset}>
                <RotateCcw size={16} />
                Recommencer le scan
              </button>
              <p className="small muted">
                Les profils à 90° ne sont pas validés par ce modèle. Les mesures correspondantes
                resteront indisponibles.
              </p>
            </section>
          ) : (
            <section className="panel">
              <div className="eyebrow">OBSERVATIONS EN DIRECT</div>
              <h2>La géométrie, simplement.</h2>
              <p className="small muted">
                Les valeurs se calculent sur une vue frontale valide. Aucun score esthétique ne
                fluctue en direct.
              </p>
              <div className="live-metrics">
                {['face-ratio', 'eye-spacing', 'nose-width', 'jaw-ratio'].map((id) => {
                  const m = metrics.find((v) => v.id === id);
                  const validNow =
                    camera.quality?.valid && camera.quality.frontal && !camera.paused;
                  return (
                    <div key={id}>
                      <span>
                        {m?.name ??
                          {
                            'face-ratio': 'Largeur / hauteur',
                            'eye-spacing': 'Écartement des yeux',
                            'nose-width': 'Largeur du nez',
                            'jaw-ratio': 'Contour mandibulaire',
                          }[id]}
                      </span>
                      <strong className="mono">
                        {validNow && m?.value !== null && m?.value !== undefined
                          ? m.value.toFixed(3)
                          : '—'}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="observation-count">
                <span className="status-dot" />
                {count} observations frontales retenues
              </div>
              <button
                className="button primary full"
                disabled={count < 5}
                onClick={() =>
                  onReport(
                    aggregate(observations.current, 'live', 0, {
                      captureIssues: [...captureIssues.current],
                    }),
                  )
                }
              >
                Créer mon rapport
                <ArrowRight size={17} />
              </button>
              <p className="small muted">
                Au moins 5 observations exploitables. Conservez la tête droite et une expression
                neutre.
              </p>
            </section>
          )}
          <section className="panel quality-panel">
            <div className="eyebrow">QUALITÉ DE CAPTURE</div>
            <div className={`quality-status ${camera.quality?.valid ? 'good' : ''}`}>
              <span className={`status-dot ${camera.quality?.valid ? '' : 'off'}`} />
              {camera.quality?.valid ? 'Capture exploitable' : 'En attente d’une capture valide'}
            </div>
            {camera.quality && (
              <>
                <div className="pose-values">
                  {(['yaw', 'pitch', 'roll'] as const).map((key, i) => (
                    <div key={key}>
                      <span>{['Rotation', 'Inclinaison', 'Roulis'][i]}</span>
                      <strong className="mono">
                        {camera.detection?.pose.source === 'matrix'
                          ? `${camera.detection.pose[key].toFixed(0)}°`
                          : '—'}
                      </strong>
                    </div>
                  ))}
                </div>
                <ul className="quality-issues">
                  {camera.quality.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                  {camera.quality.valid && !camera.quality.frontal && !guided && (
                    <li>Revenez de face pour calculer les mesures.</li>
                  )}
                </ul>
              </>
            )}
            <p className="small muted">
              <Info size={13} /> Indicateurs calculés par PSL Lens, sans confiance statistique du
              modèle.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
