import { useId, useState } from 'react';
import type { ProfileAnalysis } from '../types/v2';
import { PROFILE_POINTS } from '../morphometry/profile';
import { buildProfileGeometry } from '../morphometry/profile/geometry';
export function ProfileResult({ profile: p }: { profile: ProfileAnalysis }) {
  const diagramId = useId();
  const [photo, setPhoto] = useState(false);
  const [selected, setSelected] = useState(p.measurements[0]?.id);
  const metric = p.measurements.find((m) => m.id === selected);
  const geometry = selected ? buildProfileGeometry(p, selected) : null;
  const keys = geometry?.points.flatMap((point) => (point.landmark ? [point.landmark] : [])) ?? [];
  const validDimensions =
    Number.isFinite(p.width) && Number.isFinite(p.height) && p.width > 0 && p.height > 0;
  const width = validDimensions ? p.width : 1000;
  const height = validDimensions ? p.height : 1000;
  const confirmed = PROFILE_POINTS.flatMap((definition) => {
    const point = p.points[definition.id];
    return validDimensions &&
      point?.confirmed &&
      [point.x, point.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      ? [{ ...definition, point, x: point.x * width, y: point.y * height }]
      : [];
  });
  let viewport = { x: 0, y: 0, width, height };
  if (!photo && confirmed.length) {
    const bounds = [
      ...confirmed,
      ...(geometry?.segments.flatMap((segment) => [segment.from, segment.to]) ?? []),
      ...(geometry?.arcs.flatMap((arc) => [
        { x: arc.center.x - arc.radius, y: arc.center.y - arc.radius },
        { x: arc.center.x + arc.radius, y: arc.center.y + arc.radius },
      ]) ?? []),
    ];
    const left = Math.min(...bounds.map((point) => point.x));
    const top = Math.min(...bounds.map((point) => point.y));
    const right = Math.max(...bounds.map((point) => point.x));
    const bottom = Math.max(...bounds.map((point) => point.y));
    const padding = Math.max(
      Math.hypot(right - left, bottom - top) * 0.12,
      Math.min(width, height) * 0.02,
    );
    viewport = {
      x: left - padding,
      y: top - padding,
      width: right - left + 2 * padding,
      height: bottom - top + 2 * padding,
    };
  }
  const drawingWidth = viewport.width;
  return (
    <section className="panel profile-result">
      <span className="eyebrow">
        PROFIL {p.side === 'left' ? 'GAUCHE' : p.side === 'right' ? 'DROIT' : '· CÔTÉ NON DÉCLARÉ'}{' '}
        · ASSISTÉ
      </span>
      <h2>La géométrie du contour visible</h2>
      <p>1 observation · placement manuel · {p.algorithm} · fiabilité limitée</p>
      <p className="small muted">
        Sens dans l’image :{' '}
        {p.facing === 'image-right'
          ? 'vers la droite'
          : p.facing === 'image-left'
            ? 'vers la gauche'
            : 'indéterminé'}
        . Côté anatomique : déclaration de l’utilisateur.
      </p>
      <div className="profile-report-layout">
        <div>
          <svg
            className="profile-diagram"
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}
            role="img"
            aria-label="Construction géométrique du profil confirmé"
            aria-describedby={`${diagramId}-description`}
          >
            <title>{metric?.name ?? 'Repères confirmés du profil'}</title>
            <desc id={`${diagramId}-description`}>
              {geometry?.description ??
                'Construction indisponible pour cette mesure. Aucun segment de mesure n’est tracé.'}
            </desc>
            {photo && p.preview && <image href={p.preview} width={p.width} height={p.height} />}
            {geometry?.segments.map((segment, index) => (
              <line
                key={index}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                data-role={segment.role}
                stroke={
                  segment.role === 'denominator' || segment.role === 'reference'
                    ? '#6ae7d7'
                    : '#ffca80'
                }
                strokeWidth={drawingWidth / 220}
                strokeDasharray={
                  segment.role === 'projection'
                    ? `${drawingWidth / 500} ${drawingWidth / 100}`
                    : segment.role === 'denominator' || segment.role === 'reference'
                      ? `${drawingWidth / 60} ${drawingWidth / 120}`
                      : undefined
                }
                strokeLinecap="round"
              >
                <title>{segment.label}</title>
              </line>
            ))}
            {geometry?.arcs.map((arc, index) => {
              const start = {
                x: arc.center.x + Math.cos(arc.startAngle) * arc.radius,
                y: arc.center.y + Math.sin(arc.startAngle) * arc.radius,
              };
              const end = {
                x: arc.center.x + Math.cos(arc.endAngle) * arc.radius,
                y: arc.center.y + Math.sin(arc.endAngle) * arc.radius,
              };
              return (
                <path
                  key={index}
                  data-role="angle"
                  d={`M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 0 ${arc.endAngle >= arc.startAngle ? 1 : 0} ${end.x} ${end.y}`}
                  fill="none"
                  stroke="#ffca80"
                  strokeWidth={drawingWidth / 220}
                >
                  <title>
                    {arc.label} : {arc.valueDegrees.toFixed(1)}°
                  </title>
                </path>
              );
            })}
            {geometry?.points
              .filter((point) => point.role === 'projection')
              .map((point, index) => (
                <circle
                  key={index}
                  data-role="projection-foot"
                  cx={point.point.x}
                  cy={point.point.y}
                  r={drawingWidth / 110}
                  fill="#111a29"
                  stroke="#ffca80"
                  strokeWidth={drawingWidth / 350}
                >
                  <title>{point.label}</title>
                </circle>
              ))}
            {confirmed.map((item) => {
              const anchorEnd = item.point.x > 0.7 || item.x > viewport.x + viewport.width * 0.58;
              return (
                <g key={item.id}>
                  <circle
                    cx={item.x}
                    cy={item.y}
                    r={drawingWidth / 110}
                    fill={keys.includes(item.id) ? '#ffca80' : '#4edac8'}
                  />
                  <text
                    x={item.x + (anchorEnd ? -drawingWidth / 60 : drawingWidth / 60)}
                    y={Math.min(
                      viewport.y + viewport.height * 0.975,
                      Math.max(viewport.y + viewport.height * 0.025, item.y),
                    )}
                    textAnchor={anchorEnd ? 'end' : 'start'}
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontSize={drawingWidth / 28}
                  >
                    {item.name}
                  </text>
                </g>
              );
            })}
          </svg>
          {p.preview && (
            <label className="photo-visibility">
              <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
              Afficher cette photo de profil
            </label>
          )}
          <p className="small muted">
            Traits pleins et arcs : distance ou angle mesuré. Tirets verts : longueur de référence
            N–Me ou droite Prn–Pg. Pointillés : connecteur de projection ; cercle vide : pied
            calculé. Les points pleins sont les repères confirmés. Aucune surface n’est
            reconstruite.
          </p>
          <div className="selected-construction" aria-live="polite">
            <span className="eyebrow">Construction sélectionnée</span>
            <h3>{metric?.name ?? 'Aucune mesure sélectionnée'}</h3>
            {metric && <p className="mono">{metric.formula}</p>}
            <p>
              {geometry?.description ??
                'Construction indisponible : les repères confirmés ou la géométrie nécessaires manquent pour cette mesure.'}
            </p>
          </div>
        </div>
        <div className="measurement-grid">
          {p.measurements.map((m) => (
            <details className="measurement-card" key={m.id}>
              <summary>
                {m.name}
                <strong className="measurement-value mono">
                  {m.value === null ? 'N/D' : m.value.toFixed(m.unit === '°' ? 1 : 3)}{' '}
                  <small>{m.unit}</small>
                </strong>
              </summary>
              <p>{m.formula}</p>
              <p>{m.reason ?? 'Fiabilité limitée : pointage manuel sur une photo unique.'}</p>
              <button
                className="text-link"
                style={{ minHeight: 44 }}
                aria-pressed={selected === m.id}
                onClick={() => setSelected(m.id)}
              >
                Voir les repères de cette mesure
              </button>
            </details>
          ))}
        </div>
      </div>
      <ul className="quality-issues">
        {p.quality.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </section>
  );
}
