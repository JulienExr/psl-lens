import type { PDFFont, PDFPage } from 'pdf-lib';
import type { ReportData, PDFOptions, ProfileAnalysis } from '../types/v2';
import { buildMeasurementGeometry } from '../vision/measurement-geometry';

const palette = {
  navy: [0.035, 0.09, 0.16],
  teal: [0.01, 0.53, 0.53],
  ink: [0.12, 0.19, 0.26],
  muted: [0.36, 0.43, 0.49],
  pale: [0.94, 0.97, 0.98],
} as const;
const finite = (n: number | null | undefined, digits = 2) =>
  n != null && Number.isFinite(n) ? n.toFixed(digits) : 'N/D';
const percentage = (n: number) =>
  Number.isFinite(n) ? `${Math.round(Math.min(1, Math.max(0, n)) * 100)} %` : 'N/D';
const pointNames: Record<string, string> = {
  nasion: 'Nasion',
  pronasale: 'Pronasale',
  subnasale: 'Subnasale',
  upperLip: 'Lèvre supérieure',
  lowerLip: 'Lèvre inférieure',
  pogonion: 'Pogonion',
  menton: 'Menton',
  cervical: 'Point cervical',
};
const sourceNames: Record<string, string> = {
  limited: 'limitée',
  moderate: 'modérée',
  unavailable: 'indisponible',
  'image-left': 'vers la gauche',
  'image-right': 'vers la droite',
  undetermined: 'indéterminée',
  photo: 'photo importée',
  live: 'caméra',
  guided: 'scan guidé',
  import: 'import local',
  'live-capture': 'capture caméra',
  manual: 'manuel',
  'automatic-proposal': 'proposition automatique',
  automatic: 'automatique',
  assisted: 'assisté',
};
const viewNames: Record<string, string> = {
  front: 'Frontale',
  'oblique-left': 'Oblique gauche',
  'oblique-right': 'Oblique droite',
  'profile-left': 'Profil gauche',
  'profile-right': 'Profil droit',
  'profile-unknown': 'Profil de côté non précisé',
};
const label = (value: string) => sourceNames[value] ?? value;
const date = (value?: string) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })
    : 'Date non disponible';

/** WinAnsi supports French accents; mathematical symbols are transcribed explicitly. */
function printable(text: string, font: PDFFont) {
  const replacements: Record<string, string> = {
    π: 'pi',
    '∠': 'angle',
    '×': 'x',
    '÷': '/',
    '−': '-',
    '–': '-',
    '—': '-',
    '‑': '-',
    '→': '->',
    '≈': '~',
    '≤': '<=',
    '≥': '>=',
    '√': 'sqrt',
    Σ: 'somme',
    Δ: 'delta',
    '²': '^2',
    '₁': '1',
    '₂': '2',
    ' ': ' ',
    ' ': ' ',
  };
  return Array.from(text.normalize('NFC'), (character) => {
    if (replacements[character]) return replacements[character];
    if (character === '\n' || character === '\r' || character === '\t') return ' ';
    try {
      font.encodeText(character);
      return character;
    } catch {
      return '?';
    }
  }).join('');
}

/** Generates entirely in memory. No network, persistence, print dialog or implicit image export. */
export async function generateReportPdf(
  data: ReportData,
  options: PDFOptions,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const color = (name: keyof typeof palette) =>
    rgb(palette[name][0], palette[name][1], palette[name][2]);
  const width = 595.28,
    height = 841.89,
    margin = 44,
    contentWidth = width - 2 * margin;
  let page!: PDFPage;
  let y = 0;
  let section = '';
  const draw = (
    text: string,
    x: number,
    baseline: number,
    size = 10,
    strong = false,
    tone: keyof typeof palette = 'ink',
  ) =>
    page.drawText(printable(text, strong ? bold : regular), {
      x,
      y: baseline,
      size,
      font: strong ? bold : regular,
      color: color(tone),
    });
  const newPage = (title: string, continued = false) => {
    if (!continued) section = title;
    page = document.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 97, width, height: 97, color: color('navy') });
    draw('PSL LENS / RAPPORT PERSONNEL', margin, height - 30, 9, true, 'pale');
    page.drawRectangle({ x: margin, y: height - 44, width: 34, height: 3, color: color('teal') });
    draw(title, margin, height - 74, 21, true, 'pale');
    y = height - 124;
  };
  const ensure = (space: number) => {
    if (y - space < 56) newPage(`${section} / suite`, true);
  };
  const wrap = (text: string, available: number, size: number, font = regular) => {
    const words = printable(text, font).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(`${line}${line ? ' ' : ''}${word}`, size) <= available) {
        line += `${line ? ' ' : ''}${word}`;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(line + character, size) > available && line) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const paragraph = (text: string, tone: keyof typeof palette = 'ink', size = 10) => {
    for (const line of wrap(text, contentWidth, size)) {
      ensure(size + 6);
      draw(line, margin, y, size, false, tone);
      y -= size + 5;
    }
    y -= 6;
  };
  const paragraphHeight = (text: string, size = 10) =>
    wrap(text, contentWidth, size).length * (size + 5) + 6;
  const heading = (text: string, followingSpace = 0) => {
    ensure(45 + Math.min(followingSpace, 550));
    y -= 10;
    draw(text, margin, y, 14, true, 'teal');
    y -= 24;
  };
  const measurement = (name: string, value: number | null, unit: string, details: string[]) => {
    const title = `${name} : ${finite(value, unit === '°' ? 1 : 3)} ${unit === '°' ? '°' : 'ratio'}`;
    ensure(
      Math.min(
        630,
        paragraphHeight(title, 11) +
          details.filter(Boolean).reduce((sum, detail) => sum + paragraphHeight(detail, 9), 0) +
          3,
      ),
    );
    paragraph(title, 'ink', 11);
    details.filter(Boolean).forEach((detail) => paragraph(detail, 'muted', 9));
    y -= 3;
  };
  const photo = async (preview: string | undefined, title: string) => {
    if (!options.includePhotos || !preview) return;
    // Restrict embedding to explicit local raster data URLs. Never fetch a remote URL.
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(preview)) {
      paragraph(`${title} : image omise (format local PNG/JPEG requis).`, 'muted', 9);
      return;
    }
    let image;
    try {
      image = preview.startsWith('data:image/png;')
        ? await document.embedPng(preview)
        : await document.embedJpg(preview);
    } catch {
      paragraph(`${title} : image locale illisible, omise.`, 'muted', 9);
      return;
    }
    const scale = Math.min(contentWidth / image.width, 190 / image.height);
    const photoHeight = image.height * scale;
    ensure(photoHeight + 30);
    draw(title, margin, y, 9, true);
    y -= 12;
    page.drawImage(image, {
      x: margin,
      y: y - photoHeight,
      width: image.width * scale,
      height: photoHeight,
    });
    y -= photoHeight + 20;
  };

  newPage('Synthèse');
  paragraph(
    'Une lecture descriptive, pas un jugement. Ce rapport décrit des projections 2D apparentes. Aucun diagnostic, aucune mesure osseuse ni dimension physique.',
    'ink',
    12,
  );
  heading('Acquisition et couverture');
  paragraph(`Date de génération : ${date(new Date().toISOString())}`);
  paragraph(`Date de capture : ${date(data.frontal?.createdAt ?? data.profiles[0]?.createdAt)}`);
  const availableFront =
    data.frontal?.measurements.filter((m) => m.value != null && Number.isFinite(m.value)).length ??
    0;
  paragraph(
    `Source frontale : ${data.frontal ? label(data.frontal.source) : 'absente'}. Profils assistés : ${data.profiles.length}. Vues documentées : ${data.views.length}.`,
  );
  paragraph(
    `Couverture descriptive frontale : ${availableFront} / ${data.frontal?.measurements.length ?? 0} mesures disponibles. Les profils sont documentés séparément.`,
  );
  if (data.frontal) {
    const front = data.frontal;
    paragraph(
      `Qualité de capture : ${front.quality.valid ? 'critères respectés' : 'limitée, critères incomplets'}. Fiabilité descriptive : ${availableFront === 0 ? 'indisponible' : front.measurements.filter((m) => m.value !== null).every((m) => m.confidence === 'moderate') ? 'modérée' : 'limitée'}.`,
    );
    paragraph(
      `Observations retenues : ${front.observationCount}. Mesurées : ${front.morphometryCount}. Écartées : ${front.rejectedCount}.`,
    );
  }
  paragraph(
    `Photos : ${options.includePhotos ? 'inclusion explicitement demandée, images locales seulement' : 'exclues'}. Scores : ${options.includeScores ? 'inclusion demandée' : 'exclus'}. Annexe technique : ${options.includeTechnical ? 'incluse' : 'exclue'}.`,
    'muted',
    9,
  );
  heading('Limites de lecture');
  paragraph(
    'La pose, la lumière, la focale, l’expression et les occlusions modifient les résultats. Les repères automatiques ou manuels peuvent être imprécis. La dispersion est descriptive, pas un intervalle de confiance statistique. Une seule capture ne permet pas d’estimer la répétabilité.',
  );
  if (options.includeScores) {
    heading('Scores indicatifs');
    const scores = [
      ...(data.frontal ? [['Frontal', data.frontal.frontalScore] as const] : []),
      ['Multivue', data.multiview] as const,
    ];
    for (const [name, score] of scores) {
      paragraph(
        `${name} : ${finite(score.score)} / 8. Couverture pondérée : ${percentage(score.coverage)}. Fiabilité : ${label(score.reliability)}.`,
      );
      paragraph(score.disclaimer, 'muted', 9);
      score.reasons.forEach((reason) => paragraph(reason, 'muted', 9));
      if (score.missing.length)
        paragraph(`Entrées manquantes : ${score.missing.join(', ')}.`, 'muted', 9);
      score.categories.forEach((category) =>
        paragraph(
          `${category.name} : ${finite(category.score)} / 8, poids ${percentage(category.weight)}${category.reason ? ` ; ${category.reason}` : ''}.`,
          'muted',
          9,
        ),
      );
    }
  }

  newPage('Mesures frontales');
  if (!data.frontal) paragraph('Aucune analyse frontale disponible.');
  else {
    paragraph(
      'Mesures automatiques sur la vue frontale. Les valeurs temporelles agrégées peuvent différer de la construction de l’observation représentative.',
      'muted',
      9,
    );
    await photo(data.frontal.preview, 'Photo frontale');
    for (const metric of data.frontal.measurements)
      measurement(metric.name, metric.value, metric.unit, [
        `Fiabilité : ${metric.confidence === 'moderate' ? 'modérée' : metric.confidence === 'low' ? 'limitée' : 'indisponible'}. Observations : ${metric.samples ?? 1}. Dispersion : ${(metric.samples ?? 1) > 1 ? finite(metric.spread, 4) : 'non estimable sur une capture'}.`,
        metric.reason ?? '',
        metric.limitation,
      ]);
  }

  if (data.frontal) {
    newPage('Constructions frontales');
    paragraph(
      'Vecteurs calculés sur l’observation représentative. Turquoise : numérateur ; gris en tirets : référence ; pointillés : projection ou comparaison.',
      'muted',
      9,
    );
    const front = data.frontal;
    const scenes = front.measurements
      .filter((m) => m.value !== null)
      .map((metric) => ({
        metric,
        scene: buildMeasurementGeometry(front.representative, metric.id),
      }));
    let column = 0;
    for (const { metric, scene } of scenes) {
      if (column === 0) ensure(192);
      const cardWidth = (contentWidth - 16) / 2,
        cardHeight = 182;
      const x = margin + column * (cardWidth + 16),
        top = y;
      page.drawRectangle({
        x,
        y: top - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: color('pale'),
      });
      wrap(metric.name, cardWidth - 20, 9, bold)
        .slice(0, 2)
        .forEach((line, i) => draw(line, x + 10, top - 17 - i * 12, 9, true));
      if (scene) {
        const scale = Math.min(
          (cardWidth - 32) / front.representative.width,
          120 / front.representative.height,
        );
        const offsetX = x + (cardWidth - front.representative.width * scale) / 2;
        const offsetY = top - 42;
        const at = (p: { x: number; y: number }) => ({
          x: offsetX + p.x * scale,
          y: offsetY - p.y * scale,
        });
        scene.axes.forEach((axis) =>
          page.drawLine({
            start: at(axis.from),
            end: at(axis.to),
            thickness: 0.7,
            color: color('muted'),
            dashArray: [3, 3],
          }),
        );
        scene.segments.forEach((segment) =>
          page.drawLine({
            start: at(segment.from),
            end: at(segment.to),
            thickness: segment.role === 'numerator' ? 1.6 : 0.8,
            color: color(segment.role === 'numerator' ? 'teal' : 'muted'),
            dashArray:
              segment.role === 'numerator'
                ? undefined
                : segment.role === 'denominator'
                  ? [4, 3]
                  : [1, 2],
          }),
        );
        scene.arcs.forEach((arc) => {
          for (let i = 0; i < 16; i++) {
            const a = arc.startAngle + ((arc.endAngle - arc.startAngle) * i) / 16;
            const b = arc.startAngle + ((arc.endAngle - arc.startAngle) * (i + 1)) / 16;
            page.drawLine({
              start: at({
                x: arc.center.x + arc.radius * Math.cos(a),
                y: arc.center.y + arc.radius * Math.sin(a),
              }),
              end: at({
                x: arc.center.x + arc.radius * Math.cos(b),
                y: arc.center.y + arc.radius * Math.sin(b),
              }),
              thickness: 1.2,
              color: color('teal'),
            });
          }
        });
        scene.keypoints.forEach(({ point }) =>
          page.drawCircle({ ...at(point), size: 1.8, color: color('teal') }),
        );
      } else draw('Géométrie indisponible', x + 10, top - 86, 9, false, 'muted');
      draw(
        `${finite(metric.value, metric.unit === '°' ? 1 : 3)} ${metric.unit}`,
        x + 10,
        top - cardHeight + 12,
        10,
        true,
      );
      column = 1 - column;
      if (column === 0) y -= cardHeight + 12;
    }
    if (column === 1) y -= 194;
  }

  for (const profile of data.profiles) {
    newPage(
      `Profil ${profile.side === 'left' ? 'gauche' : profile.side === 'right' ? 'droit' : 'non précisé'}`,
    );
    paragraph(
      `${date(profile.createdAt)}. Source : ${label(profile.source)}. Méthode assistée. Couverture des mesures latérales : ${percentage(profile.quality.completeness)}.`,
    );
    paragraph(
      `Orientation déclarée par l’utilisateur : ${profile.orientation.strictProfileConfirmed ? 'profil strict confirmé' : 'profil strict non confirmé'}. Direction dans l’image : ${label(profile.facing)}. Qualité : ${profile.quality.valid ? 'exploitable avec limites' : 'limitée / incomplète'}.`,
      'muted',
      9,
    );
    await photo(profile.preview, 'Photo de profil');
    drawProfile(profile);
    heading('Mesures latérales');
    for (const metric of profile.measurements)
      measurement(metric.name, metric.value, metric.unit, [
        `Méthode assistée ; qualité ${metric.quality === 'unavailable' ? 'indisponible' : 'limitée'} ; observations : ${metric.samples}. Dispersion : ${metric.samples > 1 ? finite(metric.spread, 4) : 'non estimable sur une capture'}.`,
        metric.reason ?? '',
        ...metric.uncertainties,
      ]);
    heading('Repères et provenance');
    for (const [id, point] of Object.entries(profile.points))
      paragraph(
        `${pointNames[id] ?? id} : ${label(point.source)}, ${point.confirmed ? 'confirmé' : 'non confirmé'} ; x=${finite(point.x, 3)}, y=${finite(point.y, 3)} (coordonnées normalisées).`,
        'muted',
        9,
      );
    profile.quality.warnings.forEach((warning) => paragraph(warning, 'muted', 9));
  }

  newPage('Vues et cohérence');
  if (!data.views.length) paragraph('Aucune vue documentée.');
  for (const view of data.views) {
    heading(viewNames[view.view] ?? view.view);
    paragraph(
      `${label(view.method)} ; ${label(view.source)} ; ${view.observationCount} observation(s) ; qualité : ${view.quality}.`,
    );
    if (view.pose)
      paragraph(
        `Pose : lacet ${finite(view.pose.yaw, 1)}°, tangage ${finite(view.pose.pitch, 1)}°, roulis ${finite(view.pose.roll, 1)}° ; source ${view.pose.source}.`,
        'muted',
        9,
      );
    view.warnings.forEach((warning) => paragraph(warning, 'muted', 9));
  }
  const consistency = data.frontal?.scan?.consistency;
  heading('Continuité géométrique');
  paragraph(
    consistency
      ? `Statut : ${consistency.status === 'consistent' ? 'cohérente' : consistency.status === 'inconsistent' ? 'non validée' : 'non vérifiée'}.`
      : 'Continuité non vérifiée.',
  );
  consistency?.issues.forEach((issue) => paragraph(issue, 'muted', 9));
  consistency?.checks.forEach((check) =>
    paragraph(
      `Vue ${check.stage === 'left' ? 'gauche' : 'droite'} : taille x${finite(check.sizeRatio)}, proportion verticale x${finite(check.lowerFaceRatio)}, déplacement ${finite(check.centerShift, 3)} ; ${check.passed ? 'critères respectés' : 'à reprendre'}.`,
      'muted',
      9,
    ),
  );
  paragraph(
    'Les vues obliques contrôlent une continuité de cadrage et de proportions. Elles ne vérifient pas l’identité et ne reconstruisent pas la 3D. Les mesures frontales et latérales conservent leurs sources distinctes.',
    'muted',
    9,
  );
  heading('Avertissements de capture');
  const warnings = [
    ...new Set([...(data.frontal?.quality.issues ?? []), ...(data.frontal?.captureIssues ?? [])]),
  ];
  if (!warnings.length)
    paragraph(
      'Aucun avertissement frontal enregistré ; cela ne garantit pas l’exactitude.',
      'muted',
      9,
    );
  warnings.forEach((warning) => paragraph(warning, 'muted', 9));

  newPage('Recommandations');
  if (!data.recommendations.length) paragraph('Aucune recommandation disponible.');
  for (const recommendation of data.recommendations) {
    heading(recommendation.title);
    paragraph(`Objectif : ${recommendation.objective}`);
    paragraph(
      `Éléments observés : ${recommendation.evidence.join(' ; ') || 'non documentés'}.`,
      'muted',
      9,
    );
    paragraph(recommendation.rationale);
    paragraph(`Limites : ${recommendation.limits}`, 'muted', 9);
  }

  if (options.includeTechnical) {
    newPage('Méthodes et formules');
    paragraph(
      'Frontal : repères MediaPipe Face Landmarker ; rapports et angles dans les pixels de l’image, avec correction du roulis. Unités : ratios sans dimension et degrés. Aucune calibration métrique ni reconstruction 3D.',
    );
    for (const view of data.views)
      paragraph(
        `${viewNames[view.view] ?? view.view} : ${view.algorithm} ; ${label(view.method)} ; source ${label(view.source)} ; ${view.observationCount} observation(s).`,
        'muted',
        9,
      );
    if (!data.views.some((view) => view.view === 'front') && data.frontal)
      paragraph('Version du protocole frontal non renseignée dans les vues.', 'muted', 9);
    for (const metric of data.frontal?.measurements ?? []) {
      heading(
        metric.name,
        paragraphHeight(`Formule : ${metric.formula}`, 9) +
          paragraphHeight(`Repères : ${metric.landmarks.join(', ')}. ${metric.description}`, 9),
      );
      paragraph(`Formule : ${metric.formula}`, 'ink', 9);
      paragraph(`Repères : ${metric.landmarks.join(', ')}. ${metric.description}`, 'muted', 9);
    }
    for (const profile of data.profiles) {
      heading(`Profil : ${profile.algorithm}`);
      paragraph(
        'Coordonnées normalisées remises à l’échelle dans les pixels de la capture. Repères assistés à confirmer. La pose stricte est déclarée par l’utilisateur.',
        'muted',
        9,
      );
      for (const metric of profile.measurements) {
        paragraph(`${metric.name} : ${metric.formula}`, 'ink', 9);
        paragraph(
          `Version : ${metric.version}. Repères : ${metric.landmarks.map((id) => pointNames[id]).join(', ')}.`,
          'muted',
          9,
        );
      }
    }
    if (options.includeScores) {
      heading('Versions des scores');
      if (data.frontal) paragraph(`Frontal : ${data.frontal.frontalScore.version}.`, 'muted', 9);
      paragraph(`Multivue : ${data.multiview.version}.`, 'muted', 9);
      paragraph(
        'Les scores sont des indices exploratoires du protocole, sans validation clinique ni valeur universelle. La couverture pondérée exclut les dimensions indisponibles.',
        'muted',
        9,
      );
    }
  }

  document.getPages().forEach((sheet, i, pages) => {
    page = sheet;
    page.drawLine({
      start: { x: margin, y: 39 },
      end: { x: width - margin, y: 39 },
      color: color('teal'),
      thickness: 0.7,
    });
    draw('PSL Lens - Généré localement - Mesures 2D indicatives', margin, 25, 8, false, 'muted');
    draw(`${i + 1} / ${pages.length}`, width - margin - 35, 25, 8, false, 'muted');
  });
  document.setTitle('PSL Lens - Rapport personnel');
  document.setAuthor('PSL Lens - traitement local');
  document.setSubject('Mesures descriptives 2D et limites de capture');
  return document.save();

  function drawProfile(profile: ProfileAnalysis) {
    ensure(235);
    const top = y,
      diagramWidth = 215,
      diagramHeight = 210;
    page.drawRectangle({
      x: margin,
      y: top - diagramHeight,
      width: contentWidth,
      height: diagramHeight,
      color: color('pale'),
    });
    const validPoints = Object.entries(profile.points).filter(
      ([, point]) =>
        point.confirmed &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1,
    );
    const ratio = profile.width > 0 && profile.height > 0 ? profile.width / profile.height : 1;
    const drawWidth = Math.min(diagramWidth - 30, (diagramHeight - 30) * ratio),
      drawHeight = drawWidth / ratio;
    const at = (point: { x: number; y: number }) => ({
      x: margin + 15 + point.x * drawWidth,
      y: top - 15 - point.y * drawHeight,
    });
    const ids = [
      'nasion',
      'pronasale',
      'subnasale',
      'upperLip',
      'lowerLip',
      'pogonion',
      'menton',
      'cervical',
    ];
    for (let i = 1; i < ids.length; i++) {
      const from = validPoints.find(([id]) => id === ids[i - 1])?.[1],
        to = validPoints.find(([id]) => id === ids[i])?.[1];
      if (from && to)
        page.drawLine({ start: at(from), end: at(to), color: color('teal'), thickness: 1.4 });
    }
    // Angular constructions use the measurement's actual three landmarks and vertex.
    let angleIndex = 0;
    for (const metric of profile.measurements) {
      if (metric.unit !== '°' || metric.value === null || metric.landmarks.length !== 3) continue;
      const points = metric.landmarks.map((id) => validPoints.find(([key]) => key === id)?.[1]);
      if (points.some((point) => !point)) continue;
      const [a, vertex, b] = points.map((point) => at(point!));
      page.drawLine({
        start: vertex,
        end: a,
        thickness: 0.8,
        color: color('muted'),
        dashArray: [3, 2],
      });
      page.drawLine({
        start: vertex,
        end: b,
        thickness: 0.8,
        color: color('muted'),
        dashArray: [3, 2],
      });
      const start = Math.atan2(a.y - vertex.y, a.x - vertex.x);
      const end = Math.atan2(b.y - vertex.y, b.x - vertex.x);
      const sweep = Math.atan2(Math.sin(end - start), Math.cos(end - start));
      const radius = Math.min(
        16,
        Math.hypot(a.x - vertex.x, a.y - vertex.y) * 0.35,
        Math.hypot(b.x - vertex.x, b.y - vertex.y) * 0.35,
      );
      for (let i = 0; i < 16; i++) {
        const p = start + (sweep * i) / 16,
          q = start + (sweep * (i + 1)) / 16;
        page.drawLine({
          start: { x: vertex.x + radius * Math.cos(p), y: vertex.y + radius * Math.sin(p) },
          end: { x: vertex.x + radius * Math.cos(q), y: vertex.y + radius * Math.sin(q) },
          color: color('teal'),
          thickness: 1,
        });
      }
      draw(
        `${metric.name} : ${finite(metric.value, 1)}°`,
        margin + diagramWidth + 10,
        top - 24 - (validPoints.length + angleIndex) * 17,
        8,
        true,
        'teal',
      );
      angleIndex++;
    }
    validPoints.forEach(([id, point], i) => {
      page.drawCircle({ ...at(point), size: 2.5, color: color('teal') });
      draw(String(i + 1), at(point).x + 5, at(point).y + 2, 7, true);
      draw(`${i + 1}. ${pointNames[id] ?? id}`, margin + diagramWidth + 10, top - 24 - i * 17, 9);
    });
    draw('Repères confirmés uniquement', margin + 12, top - diagramHeight + 10, 8, false, 'muted');
    y -= diagramHeight + 18;
  }
}
