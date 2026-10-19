import type { AggregatedAnalysis } from './types';
export function captureRecommendations(analysis: AggregatedAnalysis): string[] {
  const q = analysis.quality;
  const issues = (analysis.captureIssues ?? []).join(' ');
  const advice: string[] = [];
  if ((q.brightness !== null && q.brightness < 85) || issues.includes('lumière'))
    advice.push('La capture a montré une lumière faible : placez une source diffuse devant vous.');
  if ((q.brightness !== null && q.brightness > 200) || issues.includes('surexposition'))
    advice.push('La capture a montré une lumière forte : réduisez la lumière directe.');
  if (
    (q.sharpness !== null && q.sharpness < 30) ||
    issues.includes('immobile') ||
    issues.includes('floue')
  )
    advice.push(
      'De la netteté ou de la stabilité a manqué : stabilisez la caméra et vérifiez la mise au point.',
    );
  if (q.faceSize > 0.8 || issues.includes('cadre'))
    advice.push('Le cadrage est serré : reculez légèrement pour conserver tout le contour.');
  if (analysis.morphometryCount < 5)
    advice.push(
      'Une seule capture ne mesure pas la répétabilité : essayez le Quick Scan frontal stabilisé.',
    );
  if (analysis.scan?.consistency.status === 'inconsistent')
    advice.push(
      'Les vues supplémentaires sont incohérentes : gardez la même distance et le même cadrage ou utilisez le Quick Scan.',
    );
  if (!advice.length)
    advice.push(
      'Aucun problème supplémentaire identifié parmi les critères vérifiés. Gardez des conditions de capture comparables lors d’un prochain essai.',
    );
  return advice;
}
