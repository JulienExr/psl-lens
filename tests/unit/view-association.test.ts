import { expect, it } from 'vitest';
import {
  confirmViewAssociation,
  isViewAssociationConfirmed,
} from '../../src/vision/view-association';
import { scoreMultiview } from '../../src/scoring/multiview';
import { aggregate } from '../../src/vision/temporal';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { measure } from '../../src/morphometry/metrics';
import { analyzeProfile } from '../../src/morphometry/profile';
const d = fixtureDetection();
const frontal = () =>
  aggregate(
    [
      {
        detection: d,
        quality: readyQuality,
        measurements: measure(d, readyQuality),
        stage: 'front',
      },
    ],
    'photo',
  );
const profile = () =>
  analyzeProfile({
    width: 1000,
    height: 1000,
    side: 'left',
    strictProfileConfirmed: true,
    source: 'import',
    points: Object.fromEntries(
      Object.entries({
        nasion: [0.4, 0.2],
        pronasale: [0.6, 0.4],
        subnasale: [0.45, 0.45],
        pogonion: [0.48, 0.65],
        menton: [0.4, 0.75],
      }).map(([k, [x, y]]) => [k, { x, y, source: 'manual', confirmed: true }]),
    ),
  });
it('requires explicit association for the exact views while retaining individual analyses', () => {
  const f = frontal(),
    p = profile();
  const oldScore = f.frontalScore.score;
  expect(scoreMultiview(f, [p]).score).toBeNull();
  expect(scoreMultiview(f, [p]).reasons.join(' ')).toMatch(/association.*confirm/i);
  const association = confirmViewAssociation(f, [p]);
  expect(isViewAssociationConfirmed(f, [p], association)).toBe(true);
  expect(scoreMultiview(f, [p], association).score).not.toBeNull();
  expect(f.frontalScore.score).toBe(oldScore);
  expect(p.measurements.some((m) => m.value !== null)).toBe(true);
});
it('revokes eligibility after replacing, adding or removing any view', () => {
  const f = frontal(),
    p = profile(),
    other = profile();
  const a = confirmViewAssociation(f, [p]);
  for (const [front, profiles] of [
    [frontal(), [p]],
    [f, [other]],
    [f, [p, other]],
    [null, [p]],
    [f, []],
  ] as const) {
    expect(isViewAssociationConfirmed(front, [...profiles], a)).toBe(false);
    expect(scoreMultiview(front, [...profiles], a).score).toBeNull();
  }
  expect(confirmViewAssociation(null, [p])).toBeNull();
  expect(confirmViewAssociation(f, [])).toBeNull();
});
it('does not infer association from matching metadata or duplicate identifiers', () => {
  const f = frontal(),
    p = profile();
  expect(isViewAssociationConfirmed(f, [p], null)).toBe(false);
  const a = confirmViewAssociation(f, [p]);
  expect(isViewAssociationConfirmed(f, [p, p], a)).toBe(false);
  expect(isViewAssociationConfirmed(f, [p], { ...a!, confirmedAt: 'invalid' })).toBe(false);
});

it('keeps confirmation session-only while exported unconfirmed reports have no combined score', async () => {
  const { buildReportData, exportReportData } = await import('../../src/vision/report-data');
  const f = frontal(),
    p = profile();
  const unconfirmed = exportReportData(buildReportData(f, [p]), true);
  expect(unconfirmed.multiviewScore?.score).toBeNull();
  expect(unconfirmed.measurements).toHaveLength(15);
  expect(unconfirmed.profiles).toHaveLength(1);
  const confirmed = buildReportData(f, [p], [], confirmViewAssociation(f, [p]));
  expect(confirmed.multiview.score).not.toBeNull();
  expect(exportReportData(confirmed, true)).not.toHaveProperty('association');
});
