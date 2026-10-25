import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { Report } from '../../src/features/Report';
import { aggregate } from '../../src/vision/temporal';
import { confirmViewAssociation } from '../../src/vision/view-association';
import { analyzeProfile } from '../../src/morphometry/profile';
import { measure } from '../../src/morphometry/metrics';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import type { ViewAssociation } from '../../src/types/v2';
import { generateReportPdf } from '../../src/report/generateReportPdf';
vi.mock('../../src/report/generateReportPdf', () => ({ generateReportPdf: vi.fn() }));
it('discards a pending combined-score PDF when the exact-view association is revoked through Report', async () => {
  const d = fixtureDetection();
  const front = aggregate(
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
  const profile = analyzeProfile({
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
  function Harness() {
    const [association, setAssociation] = useState<ViewAssociation | null>(() =>
      confirmViewAssociation(front, [profile]),
    );
    return (
      <Report
        analysis={front}
        profiles={[profile]}
        association={association}
        onAssociationChange={(confirmed) =>
          setAssociation(confirmed ? confirmViewAssociation(front, [profile]) : null)
        }
      />
    );
  }
  let resolve!: (bytes: Uint8Array) => void;
  vi.mocked(generateReportPdf).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const create = vi.fn(() => 'blob:test');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Préparer le PDF' }));
    const scores = await screen.findByRole('checkbox', { name: /Inclure les scores indicatifs/ });
    fireEvent.click(scores);
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
    await waitFor(() =>
      expect(generateReportPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          multiview: expect.objectContaining({ score: expect.any(Number) }),
        }),
        expect.objectContaining({ includeScores: true }),
      ),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Je confirme que les vues représentent la même personne',
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'Association des vues à confirmer' }),
    ).toBeInTheDocument();
    await act(async () => {
      resolve(new Uint8Array([37, 80, 68, 70]));
    });
    expect(create).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('checkbox', { name: /Inclure les scores indicatifs/ }),
    ).not.toBeChecked();
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

it('does not display a numeric rotation when the observation pose is unavailable', () => {
  const d = fixtureDetection();
  d.pose.source = 'unavailable';
  const analysis = aggregate(
    [
      {
        detection: d,
        quality: readyQuality,
        measurements: measure(d, readyQuality, { allowApproximate: true }),
        stage: 'front',
      },
    ],
    'live',
  );
  render(
    <MemoryRouter>
      <Report analysis={analysis} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/orientation-unknown.*orientation indisponible/)).toBeInTheDocument();
  expect(screen.queryByText(/rotation observée 0°/)).not.toBeInTheDocument();
});
