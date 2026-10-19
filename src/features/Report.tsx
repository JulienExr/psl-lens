import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Info,
  ScanFace,
  SlidersHorizontal,
} from 'lucide-react';
import type { AggregatedAnalysis, Measurement, Region } from '../types';
import { Mesh } from '../components/Mesh';
import { LocalNotice } from '../components/Controls';
import { regions } from '../components/regions';
import { DISCLAIMER } from '../scoring';
import { FrontalScorePanel } from '../components/FrontalScorePanel';
import { captureRecommendations } from '../recommendations';
import { buildMeasurementGeometry } from '../vision/measurement-geometry';

export function Report({ analysis }: { analysis: AggregatedAnalysis | null }) {
  const [showScore, setShowScore] = useState(true);
  const [region, setRegion] = useState<Region>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [showPhoto, setShowPhoto] = useState(true);
  if (!analysis)
    return (
      <div className="empty-report page-width">
        <ScanFace size={60} strokeWidth={1} />
        <span className="eyebrow">VOTRE ANALYSE PERSONNELLE</span>
        <h1>Votre rapport commence ici.</h1>
        <p>Importez une photo ou réalisez un scan pour découvrir vos mesures.</p>
        <Link to="/photo" className="button primary">
          Analyser une photo
          <ArrowRight size={17} />
        </Link>
        <Link to="/scan" className="text-link">
          Ou commencer un scan guidé
          <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  const available = analysis.measurements.filter((m) => m.value !== null);
  const selected = analysis.measurements.find((m) => m.id === selectedId);
  const descriptiveReliability = !available.length
    ? 'Indisponible'
    : available.every((m) => m.confidence === 'moderate')
      ? 'Modérée'
      : 'Limitée';
  const exportReport = () => {
    // Deliberate user-triggered export: descriptive measures only, no landmarks or image.
    const content = JSON.stringify(
      {
        createdAt: analysis.createdAt,
        source: analysis.source,
        observationCount: analysis.observationCount,
        measurements: analysis.measurements,
        ...(showScore ? { score: analysis.score, frontalScore: analysis.frontalScore } : {}),
        scan: analysis.scan,
        limitations: [
          'Mesures 2D apparentes, sans dimensions physiques.',
          'Profil non validé en V1.',
        ],
        disclaimer: DISCLAIMER,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'psl-lens-rapport.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="workspace page-width">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNE LECTURE, PAS UN JUGEMENT</span>
          <h1>Votre visage, en perspective.</h1>
          <p>
            Rapport{' '}
            {analysis.source === 'guided'
              ? 'du scan guidé'
              : analysis.source === 'live'
                ? 'Live'
                : 'photo'}{' '}
            ·{' '}
            {new Date(analysis.createdAt).toLocaleString('fr-CA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <button className="button secondary compact" onClick={exportReport}>
          <Download size={16} />
          Exporter les mesures
        </button>
        <button className="button secondary compact print-action" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </div>
      <LocalNotice />
      <div className="report-summary">
        <div>
          <span className="mono">MESURES DISPONIBLES</span>
          <strong>
            {available.length}
            <small> / 15</small>
          </strong>
        </div>
        <div>
          <span className="mono">OBSERVATIONS RETENUES</span>
          <strong>{analysis.observationCount}</strong>
        </div>
        <div>
          <span className="mono">OBSERVATIONS FRONTALES</span>
          <strong>{analysis.morphometryCount}</strong>
        </div>
        <div>
          <span className="mono">FIABILITÉ DESCRIPTIVE</span>
          <strong className="summary-word">{descriptiveReliability}</strong>
        </div>
      </div>
      <div className="report-layout">
        <aside className="report-aside">
          <section className="panel report-mesh">
            <div className="panel-top">
              <span className="mono">VOTRE MAILLAGE</span>
              <span className="status-dot" />
            </div>
            <div
              className="report-coordinate"
              style={{
                aspectRatio: `${analysis.representative.width}/${analysis.representative.height}`,
              }}
            >
              {analysis.preview && showPhoto && (
                <img src={analysis.preview} alt="Photo de l’analyse, non enregistrée" />
              )}
              {selected?.value !== null && (
                <Mesh
                  result={analysis.representative}
                  layer={selected ? 'measurements' : 'mesh'}
                  region={region}
                  measurementId={selectedId}
                />
              )}
            </div>
            {analysis.preview && (
              <label className="photo-visibility">
                <input
                  type="checkbox"
                  checked={showPhoto}
                  onChange={(e) => setShowPhoto(e.target.checked)}
                />
                Afficher la photo
              </label>
            )}
            {selected && (
              <div className="selected-construction" role="status">
                <span className="eyebrow">Construction sélectionnée</span>
                <h3>{selected.name}</h3>
                <p className="mono">
                  {selected.value === null
                    ? 'N/D'
                    : selected.value.toFixed(selected.unit === '°' ? 1 : 3)}{' '}
                  {selected.unit}
                </p>
                <p>
                  {buildMeasurementGeometry(analysis.representative, selected.id)?.description ??
                    selected.description}
                </p>
                <p>{selected.formula}</p>
                <p className="small">
                  Lignes pleines : numérateur. Tirets : référence. Pointillés :
                  projections/comparaisons. La géométrie de cette observation peut différer
                  légèrement de la médiane temporelle.
                </p>
                <button className="text-link" onClick={() => setSelectedId(undefined)}>
                  Revenir au maillage
                </button>
              </div>
            )}
            <p className="small muted">
              {analysis.preview
                ? 'Repères superposés à votre capture.'
                : 'Repères de l’observation frontale retenue. Aucune vidéo enregistrée.'}
            </p>
          </section>
          <section className="panel">
            <span className="eyebrow">POUR VOTRE PROCHAINE CAPTURE</span>
            <h3>Un peu de recul, plus de clarté.</h3>
            <ul className="recommendations">
              {captureRecommendations(analysis).map((advice) => (
                <li key={advice}>{advice}</li>
              ))}
            </ul>
            <Link to="/scan" className="text-link">
              Faire un nouveau scan
              <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
        <div className="report-content">
          {analysis.scan && (
            <section className="panel consistency-panel">
              <span className="eyebrow">
                {analysis.scan.mode === 'quick'
                  ? 'QUICK SCAN · FRONTAL STABILISÉ'
                  : 'MULTI-ANGLE · CONTRÔLE DE CONTINUITÉ'}
              </span>
              <h3>
                {analysis.scan.mode === 'quick'
                  ? 'Des mesures issues du frontal uniquement'
                  : analysis.scan.consistency.status === 'consistent'
                    ? 'Continuité géométrique cohérente'
                    : 'Continuité non validée'}
              </h3>
              <p>
                {analysis.scan.mode === 'quick'
                  ? 'Les rotations sont facultatives. Ce rapport ne prétend pas valider le profil.'
                  : 'Les vues obliques contrôlent la taille, le cadrage, la pose et une proportion verticale. Elles ne corrigent pas les mesures frontales, ne vérifient pas l’identité et ne reconstruisent pas la 3D.'}
              </p>
              {analysis.scan.mode === 'multi-angle' && (
                <>
                  {analysis.scan.consistency.issues.map((issue) => (
                    <p className="consistency-issue" key={issue}>
                      {issue}
                    </p>
                  ))}
                  <ul>
                    {analysis.scan.consistency.checks.map((check) => (
                      <li key={check.stage}>
                        Vue {check.stage === 'left' ? 'gauche' : 'droite'} : taille ×
                        {Number.isFinite(check.sizeRatio) ? check.sizeRatio.toFixed(2) : 'N/D'},
                        proportion verticale ×
                        {Number.isFinite(check.lowerFaceRatio)
                          ? check.lowerFaceRatio.toFixed(2)
                          : 'N/D'}
                        , déplacement normalisé{' '}
                        {Number.isFinite(check.centerShift) ? check.centerShift.toFixed(3) : 'N/D'}{' '}
                        · {check.passed ? 'critères respectés' : 'à reprendre'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          <div className="measurement-heading">
            <h2>Les mesures descriptives</h2>
            <span className="small muted">
              <SlidersHorizontal size={15} /> Explorez une région
            </span>
          </div>
          <div className="region-tabs" aria-label="Régions du rapport">
            {regions.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRegion(r.id);
                  setSelectedId(undefined);
                }}
                aria-pressed={region === r.id}
              >
                {r.name}
              </button>
            ))}
          </div>
          <div className="measurement-grid">
            {analysis.measurements
              .filter((m) => region === 'all' || m.region === region)
              .map((m) => (
                <MeasurementCard
                  key={m.id}
                  measurement={m}
                  onSelect={() => setSelectedId(m.id)}
                  selected={selectedId === m.id}
                />
              ))}
          </div>
          <FrontalScorePanel analysis={analysis} visible={showScore} onToggle={setShowScore} />
          <section className="limitations">
            <Info size={20} />
            <div>
              <h3>Les limites font partie du résultat.</h3>
              <p>
                Les repères sont des prédictions. Les mesures décrivent une projection 2D, sensible
                à l’objectif, à la pose, à l’expression et aux occlusions. L’inclinaison dans le
                plan est corrigée; une rotation hors du plan n’est pas reconstruite. Aucun
                diagnostic ni mesure osseuse.
              </p>
              <p>
                <strong>Indisponibles :</strong> projection du profil, dimensions physiques et
                anatomie osseuse.
                {analysis.profileProvided
                  ? ' Le profil importé sert uniquement de contexte; aucune mesure n’en est tirée.'
                  : ''}{' '}
                {analysis.rejectedCount > 0
                  ? `${analysis.rejectedCount} observations non exploitables ont été écartées pendant l’acquisition.`
                  : ''}
              </p>
              <p>
                La dispersion est un écart robuste entre observations, pas un intervalle de
                confiance statistique. Une seule photo ne permet pas d’estimer la répétabilité.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
function MeasurementCard({
  measurement: m,
  onSelect,
  selected,
}: {
  measurement: Measurement;
  onSelect: () => void;
  selected: boolean;
}) {
  const value = m.value === null ? 'N/D' : m.value.toFixed(m.unit === '°' ? 1 : 3);
  return (
    <details className={`measurement-card ${selected ? 'selected' : ''}`}>
      <summary>
        <span className="measurement-label">{m.name}</span>
        <span className="measurement-value mono">
          {value}
          <small>{m.unit === '°' ? '°' : 'ratio'}</small>
        </span>
        <span className="measure-bar" aria-hidden="true">
          <span
            style={{
              width: `${m.value === null ? 0 : Math.min(100, Math.abs(m.value) * (m.unit === '°' ? 3 : 70))}%`,
            }}
          />
        </span>
        <span className="measure-meta">
          {m.confidence === 'unavailable'
            ? 'Indisponible'
            : m.confidence === 'low'
              ? 'Fiabilité limitée'
              : 'Fiabilité modérée'}
          <span>Voir le calcul +</span>
        </span>
      </summary>
      <div className="measurement-detail">
        <button className="text-link" onClick={onSelect} aria-label={`Visualiser ${m.name}`}>
          Visualiser la construction
        </button>
        <p>{m.description}</p>
        <dl>
          <dt>Formule</dt>
          <dd className="mono">{m.formula}</dd>
          <dt>Repères MediaPipe</dt>
          <dd>{m.landmarks.join(', ')}</dd>
          <dt>Observations retenues</dt>
          <dd>{m.samples ?? 1}</dd>
          <dt>Dispersion robuste (MAD × 1,4826)</dt>
          <dd>
            {(m.samples ?? 0) > 1 && m.spread !== undefined
              ? m.spread.toFixed(4)
              : 'Non estimable sur une seule observation'}
          </dd>
          <dt>Rétention des observations</dt>
          <dd>
            {m.retention === undefined
              ? 'N/D'
              : `${Math.round(m.retention * 100)} % · taux conservé, pas une confiance du modèle`}
          </dd>
          <dt>Dispersion avant rejet</dt>
          <dd>{m.rawSpread === undefined ? 'Non estimable' : m.rawSpread.toFixed(4)}</dd>
        </dl>
        {m.reason && <p>{m.reason}</p>}
        <p className="small muted">{m.limitation}</p>
        <p className="small muted">
          La barre représente la valeur apparente, pas une note de beauté.
        </p>
      </div>
    </details>
  );
}
