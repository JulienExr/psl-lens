import { useId } from 'react';
import type { AggregatedAnalysis } from '../types';
import type { ProfileAnalysis, StylePreferences } from '../types/v2';
import { recommendV2 } from '../recommendations/v2';

interface RecommendationsPanelProps {
  frontal: AggregatedAnalysis | null;
  profiles: ProfileAnalysis[];
  preferences: StylePreferences;
  onPreferencesChange: (preferences: StylePreferences) => void;
}

const topics = [
  { id: 'hair', label: 'Coiffure' },
  { id: 'beard', label: 'Barbe' },
  { id: 'photo', label: 'Photo' },
] as const;
const targetStyle = { minHeight: 44, minWidth: 44 };

export function RecommendationsPanel({
  frontal,
  profiles,
  preferences,
  onPreferencesChange,
}: RecommendationsPanelProps) {
  const titleId = useId();
  const recommendations = recommendV2(frontal, profiles, preferences);
  const capture = recommendations.filter((item) => item.kind === 'capture');
  const presentation = recommendations.filter((item) => item.kind === 'presentation');
  const update = (change: Partial<StylePreferences>) =>
    onPreferencesChange({ ...preferences, ...change });

  return (
    <section className="panel recommendations-panel" aria-labelledby={titleId}>
      <span className="eyebrow">DES PISTES À VOTRE RYTHME</span>
      <h2 id={titleId}>Conseils de capture et de présentation</h2>
      <p className="small">
        Règles locales et déterministes. Les pistes de présentation dépendent de vos choix, sans
        déduire vos goûts ou votre identité de votre visage.
      </p>
      <h3>Capture</h3>
      {!capture.length && (
        <p className="small">
          Aucune difficulté de capture identifiée parmi les critères disponibles.
          {!frontal && !profiles.length && ' Aucune capture à examiner pour le moment.'}
        </p>
      )}
      <RecommendationList recommendations={capture} />

      <fieldset style={{ margin: '20px 0', padding: 0, border: 0 }}>
        <legend className="small">Présentation facultative — choisissez vos thèmes</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {topics.map((topic) => (
            <label
              key={topic.id}
              className="small"
              style={{ ...targetStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <input
                type="checkbox"
                checked={preferences.topics.includes(topic.id)}
                onChange={(event) =>
                  update({
                    topics: event.target.checked
                      ? [...preferences.topics, topic.id]
                      : preferences.topics.filter((id) => id !== topic.id),
                  })
                }
              />
              {topic.label}
            </label>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          <label className="select-label">
            Longueur de cheveux souhaitée
            <select
              style={targetStyle}
              value={preferences.hairLength}
              onChange={(event) =>
                update({ hairLength: event.target.value as StylePreferences['hairLength'] })
              }
            >
              <option value="unspecified">Non précisée</option>
              <option value="short">Courts</option>
              <option value="medium">Mi-longs</option>
              <option value="long">Longs</option>
            </select>
          </label>
          <label className="select-label">
            Préférence de barbe
            <select
              style={targetStyle}
              value={preferences.beard}
              onChange={(event) =>
                update({ beard: event.target.value as StylePreferences['beard'] })
              }
            >
              <option value="unspecified">Non précisée</option>
              <option value="with">Avec barbe</option>
              <option value="without">Sans barbe</option>
            </select>
          </label>
          <label className="select-label">
            Style souhaité
            <select
              style={targetStyle}
              value={preferences.style}
              onChange={(event) =>
                update({ style: event.target.value as StylePreferences['style'] })
              }
            >
              <option value="unspecified">Non précisé</option>
              <option value="classic">Classique</option>
              <option value="modern">Moderne</option>
              <option value="creative">Créatif</option>
            </select>
          </label>
        </div>
      </fieldset>
      <div aria-live="polite" aria-atomic="false">
        {preferences.topics.includes('hair') && preferences.hairLength === 'unspecified' && (
          <p className="small">Précisez la longueur souhaitée pour explorer une coiffure.</p>
        )}
        {preferences.topics.includes('beard') && preferences.beard === 'unspecified' && (
          <p className="small">
            Précisez votre préférence avec ou sans barbe pour explorer ce thème.
          </p>
        )}
        {!preferences.topics.length && (
          <p className="small">
            Activez un thème si vous souhaitez explorer des variantes de présentation.
          </p>
        )}
        <RecommendationList recommendations={presentation} />
      </div>
    </section>
  );
}

function RecommendationList({
  recommendations,
}: {
  recommendations: ReturnType<typeof recommendV2>;
}) {
  if (!recommendations.length) return null;
  return (
    <ul className="recommendations" style={{ listStyle: 'none', paddingLeft: 0 }}>
      {recommendations.map((item) => (
        <li
          key={item.id}
          style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}
        >
          <h3>{item.title}</h3>
          <dl style={{ margin: 0 }}>
            <dt className="mono">Objectif</dt>
            <dd style={{ margin: '4px 0 12px' }}>{item.objective}</dd>
            <dt className="mono">Éléments utilisés</dt>
            <dd style={{ margin: '4px 0 12px' }}>
              <ul style={{ paddingLeft: 16 }}>
                {item.evidence.map((evidence, index) => (
                  <li key={index}>{evidence}</li>
                ))}
              </ul>
            </dd>
            <dt className="mono">Pourquoi essayer</dt>
            <dd style={{ margin: '4px 0 12px' }}>{item.rationale}</dd>
            <dt className="mono">Limites</dt>
            <dd style={{ margin: '4px 0 12px' }}>{item.limits}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
