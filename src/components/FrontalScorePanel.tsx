import type { AggregatedAnalysis } from '../types';
import { DISCLAIMER } from '../scoring';

export function FrontalScorePanel({
  analysis,
  visible,
  onToggle,
}: {
  analysis: AggregatedAnalysis;
  visible: boolean;
  onToggle: (value: boolean) => void;
}) {
  const result = analysis.frontalScore;
  return (
    <section className="panel scoring-panel">
      <label className="score-toggle">
        <span>
          <strong>Afficher la notation esthétique</strong>
          <small>Facultatif · protocole frontal subjectif, distinct du PSL complet</small>
        </span>
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label="Afficher la notation esthétique"
        />
      </label>
      {visible && (
        <>
          <div className="frontal-score">
            <span className="eyebrow">PSL frontal expérimental /8</span>
            <div className="frontal-score-value">
              <output aria-label="Score PSL frontal expérimental">
                {result.score === null ? '—' : result.score.toFixed(2)}
              </output>
              <span>/ 8</span>
            </div>
            <p className="score-reliability">
              {result.reliability === 'limited'
                ? 'Fiabilité limitée · photo unique'
                : result.reliability === 'moderate'
                  ? 'Fiabilité descriptive modérée · série stabilisée'
                  : 'Note refusée · données insuffisantes ou instables'}
            </p>
            <ul className="score-reasons">
              {result.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="score-categories">
            {result.categories.map((category) => (
              <details key={category.id}>
                <summary>
                  <span>
                    {category.name}
                    <small>Poids frontal : {Math.round(category.weight * 100)} %</small>
                  </span>
                  <strong className="mono">
                    {category.score === null ? 'N/D' : `${category.score.toFixed(2)} / 8`}
                  </strong>
                </summary>
                <div className="score-detail">
                  {category.reason && <p>{category.reason}</p>}
                  {category.inputs.map((input) => (
                    <p key={input.id}>
                      <strong>{analysis.measurements.find((m) => m.id === input.id)?.name}</strong>
                      <br />
                      Valeur : {input.value.toFixed(3)} · cible de conception : {input.target} ·
                      tolérance : {input.tolerance}
                      <br />
                      Contribution interne : {input.score.toFixed(2)} / 8
                    </p>
                  ))}
                  {category.contribution !== null && (
                    <p>Contribution pondérée frontale : {category.contribution.toFixed(3)} / 8.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
          <p className="small muted">
            Version {result.version}. Pondérations 30/25/20/25 propres au protocole frontal. Cibles
            arbitraires, sans norme d’attractivité.
          </p>
          <div className="complete-score-notice">
            <h3>PSL complet : indisponible</h3>
            <p>
              Protocole historique {analysis.score.version} : le profil non validé reste manquant.
              Le score frontal ne prétend pas le remplacer.
            </p>
          </div>
        </>
      )}
      <p className="score-disclaimer">{DISCLAIMER}</p>
    </section>
  );
}
