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

export function Report({ analysis }: { analysis: AggregatedAnalysis | null }) {
  const [showScore, setShowScore] = useState(true);
  const [region, setRegion] = useState<Region>('all');
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
  const exportReport = () => {
    // Deliberate user-triggered export: descriptive measures only, no landmarks or image.
    const content = JSON.stringify(
      {
        createdAt: analysis.createdAt,
        source: analysis.source,
        observationCount: analysis.observationCount,
        measurements: analysis.measurements,
        ...(showScore ? { score: analysis.score } : {}),
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
          <strong className="summary-word">
            {analysis.morphometryCount >= 5 ? 'Modérée' : 'Limitée'}
          </strong>
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
              {analysis.preview && (
                <img src={analysis.preview} alt="Photo de l’analyse, non enregistrée" />
              )}
              <Mesh result={analysis.representative} layer="mesh" region={region} />
            </div>
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
              <li>
                Placez l’objectif à hauteur des yeux et éloignez-le pour réduire la perspective.
              </li>
              <li>Utilisez une lumière diffuse, face à vous.</li>
              {analysis.morphometryCount < 5 && (
                <li>
                  Essayez le scan guidé : plusieurs observations permettent d’estimer la dispersion.
                </li>
              )}
              <li>
                Pour explorer votre présentation, comparez différentes coiffures dans les mêmes
                conditions lumineuses.
              </li>
            </ul>
            <Link to="/scan" className="text-link">
              Faire un nouveau scan
              <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
        <div className="report-content">
          <div className="measurement-heading">
            <h2>Les mesures descriptives</h2>
            <span className="small muted">
              <SlidersHorizontal size={15} /> Explorez une région
            </span>
          </div>
          <div className="region-tabs" aria-label="Régions du rapport">
            {regions.map((r) => (
              <button key={r.id} onClick={() => setRegion(r.id)} aria-pressed={region === r.id}>
                {r.name}
              </button>
            ))}
          </div>
          <div className="measurement-grid">
            {analysis.measurements
              .filter((m) => region === 'all' || m.region === region)
              .map((m) => (
                <MeasurementCard key={m.id} measurement={m} />
              ))}
          </div>
          <section className="panel scoring-panel">
            <label className="score-toggle">
              <span>
                <strong>Afficher les sous-scores expérimentaux</strong>
                <small>Facultatif · heuristique subjective de conception</small>
              </span>
              <input
                type="checkbox"
                checked={showScore}
                onChange={(e) => setShowScore(e.target.checked)}
                aria-label="Afficher les sous-scores expérimentaux"
              />
            </label>
            {showScore && (
              <>
                <div className="score-unavailable">
                  <span className="score-dash">
                    —<small>/ 8</small>
                  </span>
                  <div>
                    <h3>Score global indisponible</h3>
                    <p>
                      La composante du profil manque. Aucun total n’est extrapolé à partir des
                      catégories disponibles.
                    </p>
                  </div>
                </div>
                <div className="score-categories">
                  {analysis.score.categories.map((c) => (
                    <details key={c.id}>
                      <summary>
                        <span>
                          {c.name}
                          <small>Poids : {Math.round(c.weight * 100)} %</small>
                        </span>
                        <strong className="mono">
                          {c.score === null ? 'N/D' : `${c.score.toFixed(2)} / 8`}
                        </strong>
                      </summary>
                      <div className="score-detail">
                        {c.reason && <p>{c.reason}</p>}
                        {c.inputs.map((i) => (
                          <p key={i.id}>
                            <strong>
                              {analysis.measurements.find((m) => m.id === i.id)?.name}
                            </strong>
                            <br />
                            Valeur : {i.value.toFixed(3)} · cible de conception : {i.target} ·
                            tolérance : {i.tolerance}
                            <br />
                            Contribution interne : {i.score.toFixed(2)} / 8
                          </p>
                        ))}
                        {c.contribution !== null && (
                          <p>
                            Contribution pondérée au total potentiel : {c.contribution.toFixed(3)}.
                            Total non calculé.
                          </p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
                <p className="small muted">
                  Version {analysis.score.version}. Cibles arbitraires, sans référence à une
                  population ou preuve d’attractivité.
                </p>
              </>
            )}
            <p className="score-disclaimer">{DISCLAIMER}</p>
          </section>
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
function MeasurementCard({ measurement: m }: { measurement: Measurement }) {
  const value = m.value === null ? 'N/D' : m.value.toFixed(m.unit === '°' ? 1 : 3);
  return (
    <details className="measurement-card">
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
