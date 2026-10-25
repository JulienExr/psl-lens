import type { AggregatedAnalysis } from '../types';
import type { ProfileAnalysis, Recommendation, StylePreferences } from '../types/v2';

export const DEFAULT_PREFERENCES: StylePreferences = {
  hairLength: 'unspecified',
  beard: 'unspecified',
  style: 'unspecified',
  topics: [],
};

const captureLimits =
  'Ces contrôles décrivent la capture 2D. Ils ne constituent ni un diagnostic ni une évaluation de votre apparence.';
const presentationLimits =
  'Piste facultative fondée sur vos choix déclarés, sans prédiction de résultat ni classement esthétique. La photo ne révèle ni vos goûts ni la texture des cheveux ou la pousse de la barbe.';
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);

/** Pure, local rules: capture evidence first; presentation requires explicit opt-in. */
export function recommendV2(
  frontal: AggregatedAnalysis | null,
  profiles: ProfileAnalysis[],
  prefs: StylePreferences,
): Recommendation[] {
  const result: Recommendation[] = [];
  const capture = (
    id: string,
    title: string,
    objective: string,
    evidence: string[],
    rationale: string,
  ) =>
    result.push({
      id,
      kind: 'capture',
      title,
      objective,
      evidence,
      rationale,
      limits: captureLimits,
    });

  if (frontal) {
    const q = frontal.quality;
    const issues = [...new Set([...(frontal.captureIssues ?? []), ...q.issues])];
    const matching = (pattern: RegExp) => issues.filter((issue) => pattern.test(issue));
    const qualityRule = (
      id: string,
      title: string,
      objective: string,
      value: number | null,
      measuredIssue: (value: number) => boolean,
      label: string,
      pattern: RegExp,
      rationale: string,
    ) => {
      const evidence = matching(pattern);
      if (finite(value) && measuredIssue(value)) evidence.unshift(`${label} : ${value}.`);
      if (evidence.length) capture(id, title, objective, evidence, rationale);
    };

    qualityRule(
      'capture-light-low',
      'Éclairer la capture',
      'Essayez une lumière diffuse placée devant vous.',
      q.brightness,
      (n) => n < 45,
      'Luminosité mesurée (0–255)',
      /Ajoutez une lumière douce/i,
      'Une lumière plus uniforme peut faciliter la détection des repères.',
    );
    qualityRule(
      'capture-light-high',
      'Réduire la surexposition',
      'Réduisez la lumière directe et vérifiez une nouvelle capture.',
      q.brightness,
      (n) => n > 225,
      'Luminosité mesurée (0–255)',
      /Réduisez la surexposition/i,
      'Une zone surexposée peut masquer des détails utiles au repérage.',
    );
    qualityRule(
      'capture-sharpness',
      'Améliorer la netteté',
      'Stabilisez la caméra puis vérifiez la mise au point.',
      q.sharpness,
      (n) => n < 12,
      'Netteté mesurée (variance du Laplacien)',
      /Image trop floue/i,
      'Le flou peut rendre le placement des repères moins répétable.',
    );
    qualityRule(
      'capture-framing-small',
      'Agrandir le visage dans le cadre',
      'Rapprochez légèrement la caméra en gardant le contour entier.',
      q.faceSize,
      (n) => n > 0 && n < 0.28,
      'Part de la hauteur occupée par le visage',
      /visage est trop petit/i,
      'Davantage de pixels sur le visage peut faciliter la localisation des repères.',
    );
    qualityRule(
      'capture-framing-tight',
      'Conserver le contour dans le cadre',
      'Reculez légèrement et laissez une marge autour du visage.',
      q.faceSize,
      (n) => n > 0.8,
      'Part de la hauteur occupée par le visage',
      /Gardez tout le visage dans le cadre/i,
      'Une marge réduit le risque de couper les repères périphériques.',
    );
    qualityRule(
      'capture-stability',
      'Stabiliser la capture',
      'Posez la caméra et restez immobile pendant la prochaine acquisition.',
      q.stability,
      (n) => n > 1,
      'Indice de mouvement mesuré',
      /Restez immobile/i,
      'Moins de mouvement permet de mieux comparer les observations successives.',
    );

    const pose = frontal.representative.pose;
    const poseKnown =
      pose.source === 'matrix' && [pose.yaw, pose.pitch, pose.roll].every(Number.isFinite);
    const poseEvidence = matching(/Redressez la tête et limitez la rotation/i);
    if (
      poseKnown &&
      (Math.abs(pose.yaw) > 12 || Math.abs(pose.pitch) > 12 || Math.abs(pose.roll) > 20)
    ) {
      poseEvidence.unshift(
        `Orientation mesurée : rotation ${pose.yaw}°, inclinaison verticale ${pose.pitch}°, inclinaison latérale ${pose.roll}°.`,
      );
    }
    if (poseEvidence.length) {
      capture(
        'capture-pose',
        'Reprendre une vue de face',
        'Pour les mesures frontales, regardez la caméra et redressez doucement la tête.',
        poseEvidence,
        'Les proportions frontales apparentes varient avec la perspective et la rotation.',
      );
    }
    if (!poseKnown) {
      capture(
        'capture-pose-unverified',
        'Vérifier l’orientation',
        'Réalisez une nouvelle capture frontale dont l’orientation peut être vérifiée.',
        ['Orientation de la capture représentative indisponible.'],
        'Une orientation absente empêche de confirmer les conditions de mesure frontale.',
      );
    }

    const unverified = matching(/Qualité lumineuse et netteté non vérifiées/i);
    if (unverified.length)
      capture(
        'capture-quality-unverified',
        'Vérifier la qualité de l’image',
        'Contrôlez visuellement la lumière et la netteté, puis reprenez une capture si nécessaire.',
        unverified,
        'Des contrôles indisponibles ne prouvent ni un manque de lumière ni du flou.',
      );
    const expression = matching(/Gardez une expression neutre et les yeux ouverts/i);
    if (expression.length)
      capture(
        'capture-expression',
        'Comparer une expression neutre',
        'Pour une comparaison des mesures, reprenez une vue avec une expression détendue et les yeux ouverts.',
        expression,
        'L’expression peut déplacer les repères autour des yeux et de la bouche.',
      );
    const faceIssues = matching(/Gardez un seul visage|Aucun visage exploitable/i);
    if (faceIssues.length)
      capture(
        'capture-detection',
        'Reprendre une capture exploitable',
        'Cadrez un seul visage entièrement visible avant de relancer l’analyse.',
        faceIssues,
        'Les mesures demandent des repères détectés sur un seul visage.',
      );

    if (Number.isFinite(frontal.morphometryCount) && frontal.morphometryCount < 5)
      capture(
        'capture-repeatability',
        'Vérifier la répétabilité',
        'Essayez le Quick Scan frontal avec une caméra stable.',
        [`Observations frontales mesurées : ${frontal.morphometryCount}.`],
        'Moins de cinq observations ne permettent pas d’évaluer la répétabilité selon le protocole de l’application.',
      );
    if (frontal.scan?.consistency.status === 'inconsistent')
      capture(
        'capture-consistency',
        'Garder des vues comparables',
        'Conservez la même distance et le même cadrage, ou recommencez avec le Quick Scan frontal.',
        ['Contrôle de cohérence du scan : incohérent.', ...frontal.scan.consistency.issues],
        'Des conditions variables entre les vues limitent leur comparaison.',
      );
  }

  for (const profile of [...profiles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!profile.quality.valid || !profile.orientation.strictProfileConfirmed) {
      const evidence = [...profile.quality.warnings];
      if (!profile.quality.valid)
        evidence.unshift('Validation des repères du profil : incomplète ou non valide.');
      if (!profile.orientation.strictProfileConfirmed)
        evidence.push('Vue strictement latérale non confirmée.');
      capture(
        `capture-profile-${profile.id}`,
        'Vérifier le profil assisté',
        'Vérifiez la vue latérale, le côté déclaré et le placement des repères, puis confirmez la validation.',
        evidence,
        'Les mesures du profil dépendent des repères confirmés et de la vue latérale déclarée.',
      );
    }
  }

  const style = {
    unspecified: 'non précisé',
    classic: 'classique',
    modern: 'moderne',
    creative: 'créatif',
  }[prefs.style];
  const approach = {
    unspecified: 'deux mises en forme réversibles',
    classic: 'une mise en forme sobre et une raie simple',
    modern: 'une mise en forme texturée et une séparation plus nette',
    creative: 'deux répartitions de volume ou de raie différentes',
  }[prefs.style];
  const presentation = (
    id: string,
    title: string,
    objective: string,
    evidence: string[],
    rationale: string,
  ) =>
    result.push({
      id,
      kind: 'presentation',
      title,
      objective,
      evidence,
      rationale,
      limits: presentationLimits,
    });
  if (prefs.topics.includes('hair') && prefs.hairLength !== 'unspecified') {
    const length = { short: 'courts', medium: 'mi-longs', long: 'longs' }[prefs.hairLength];
    presentation(
      'presentation-hair',
      'Explorer une coiffure',
      `Pour des cheveux ${length}, comparez ${approach} sur des photos prises dans les mêmes conditions.`,
      [
        'Thème coiffure activé.',
        `Longueur souhaitée : cheveux ${length}.`,
        `Style déclaré : ${style}.`,
      ],
      'Comparer des variantes choisies aide à préciser vos préférences sans déduire une coupe idéale de la géométrie du visage.',
    );
  }
  if (prefs.topics.includes('beard') && prefs.beard !== 'unspecified')
    presentation(
      'presentation-beard',
      'Explorer une présentation avec ou sans barbe',
      prefs.beard === 'with'
        ? `Si vous portez une barbe, comparez deux entretiens réversibles dans un style ${style}, à longueur comparable.`
        : 'Pour votre préférence sans barbe, comparez la présentation choisie sur deux photos en lumière identique.',
      [
        'Thème barbe activé.',
        `Préférence déclarée : ${prefs.beard === 'with' ? 'avec barbe' : 'sans barbe'}.`,
        `Style déclaré : ${style}.`,
      ],
      'Une comparaison à conditions constantes permet de juger votre propre préférence. Aucune pilosité n’est déduite de l’image.',
    );
  if (prefs.topics.includes('photo'))
    presentation(
      'presentation-photo',
      'Explorer une présentation photographique',
      `Pour un style ${style}, comparez deux éclairages diffus ou deux arrière-plans à distance et cadrage constants.`,
      ['Thème photo activé.', `Style déclaré : ${style}.`],
      'Cette exploration volontaire aide à choisir une ambiance ; elle ne signale aucun défaut de la capture existante.',
    );
  return result;
}
