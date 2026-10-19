import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/app/App';
import { Report } from '../../src/features/Report';
import { aggregate } from '../../src/vision/temporal';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { measure } from '../../src/morphometry/metrics';

vi.mock('../../src/vision/client', () => ({
  visionClient: { init: vi.fn(), dispose: vi.fn(), detect: vi.fn(), modeLabel: 'Test' },
}));
describe('application flows', () => {
  it('navigates to Live without asking for permission automatically', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    render(
      <MemoryRouter initialEntries={['/live']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /Activer la caméra/i })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('explains camera denial and offers photo analysis', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    render(
      <MemoryRouter initialEntries={['/live']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Activer la caméra/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission caméra refusée');
  });
  it('rejects an incorrect photo format', async () => {
    render(
      <MemoryRouter initialEntries={['/photo']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Photo de face'), {
      target: { files: [new File(['abc'], 'test.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Format non pris en charge');
  });
  it('shows an empty report and resets session', async () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Votre rapport commence ici.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la session' }));
    await waitFor(() => expect(screen.getByText('Session effacée.')).toBeInTheDocument());
  });
});
describe('honest partial report', () => {
  it('shows unavailable global score, details and supports hiding aesthetic scores', () => {
    const detection = fixtureDetection();
    const report = aggregate(
      [
        {
          detection,
          quality: readyQuality,
          measurements: measure(detection, readyQuality),
          stage: 'front',
        },
      ],
      'photo',
    );
    render(
      <MemoryRouter>
        <Report analysis={report} />
      </MemoryRouter>,
    );
    expect(screen.getByText('PSL frontal expérimental /8')).toBeInTheDocument();
    expect(screen.getByText('PSL complet : indisponible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Afficher la notation esthétique' }));
    expect(screen.queryByText('PSL frontal expérimental /8')).not.toBeInTheDocument();
    expect(screen.getByText('Largeur / hauteur du visage')).toBeInTheDocument();
  });
});

it('lets the report select the actual geometric construction for a measurement', () => {
  const detection = fixtureDetection();
  const analysis = aggregate(
    [
      {
        detection,
        quality: readyQuality,
        measurements: measure(detection, readyQuality),
        stage: 'front',
      },
    ],
    'photo',
  );
  render(
    <MemoryRouter>
      <Report analysis={analysis} />
    </MemoryRouter>,
  );
  fireEvent.click(
    within(document.querySelector('.measurement-card') as HTMLElement).getByText(
      'Largeur / hauteur du visage',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Visualiser Largeur / hauteur du visage' }));
  expect(screen.getByText('Construction sélectionnée')).toBeInTheDocument();
  expect(
    document.querySelector('.report-coordinate svg line[data-role="denominator"]'),
  ).not.toBeNull();
});

it('keeps a dispersed report limited and does not draw a missing measurement', () => {
  const detection = fixtureDetection();
  const observation = {
    detection,
    quality: readyQuality,
    measurements: measure(detection, readyQuality),
    stage: 'front' as const,
  };
  const analysis = aggregate(
    Array.from({ length: 6 }, () => observation),
    'live',
  );
  analysis.measurements[0] = {
    ...analysis.measurements[0],
    value: null,
    confidence: 'unavailable',
    samples: 0,
  };
  analysis.measurements[1] = {
    ...analysis.measurements[1],
    confidence: 'low',
    reliabilityReason: 'dispersion',
  };
  render(
    <MemoryRouter>
      <Report analysis={analysis} />
    </MemoryRouter>,
  );
  expect(document.querySelector('.report-summary')).toHaveTextContent('Limitée');
  fireEvent.click(
    within(document.querySelector('.measurement-card') as HTMLElement).getByText(
      'Largeur / hauteur du visage',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Visualiser Largeur / hauteur du visage' }));
  expect(document.querySelector('.report-coordinate svg')).toBeNull();
  expect(screen.getByText('N/D')).toBeInTheDocument();
});
