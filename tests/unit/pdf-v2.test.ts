import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generateReportPdf } from '../../src/report/generateReportPdf';
import * as pdfGenerator from '../../src/report/generateReportPdf';
import type { ReportData } from '../../src/types/v2';
import { fixtureDetection, readyQuality } from '../fixtures/face';
import { measure } from '../../src/morphometry/metrics';
import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PDFExportControls } from '../../src/report/PDFExportControls';

export const pdfFixture = (): ReportData => {
  const score = {
    version: 'psl-frontal-1.1.0',
    score: 7.123,
    categories: [],
    missing: [],
    disclaimer: 'Indicatif',
    coverage: 0.8,
    reliability: 'limited' as const,
    reasons: ['Projection 2D'],
  };
  return {
    frontal: {
      id: 'front',
      createdAt: '2026-10-24T12:00:00Z',
      source: 'photo',
      measurements: measure(fixtureDetection(), readyQuality),
      score,
      frontalScore: score,
      observationCount: 1,
      morphometryCount: 1,
      rejectedCount: 0,
      quality: readyQuality,
      representative: fixtureDetection(),
      preview:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aen8AAAAASUVORK5CYII=',
    },
    profiles: [
      {
        id: 'profile',
        createdAt: '2026-10-24T12:00:00Z',
        side: 'left',
        facing: 'image-left',
        width: 500,
        height: 600,
        source: 'import',
        method: 'assisted',
        algorithm: 'profile-2d-2.0.0',
        orientation: { method: 'user-declared', strictProfileConfirmed: true },
        quality: {
          valid: true,
          warnings: ['Repères manuels sensibles au placement.'],
          completeness: 1,
        },
        points: {
          nasion: { x: 0.6, y: 0.2, source: 'manual', confirmed: true },
          pronasale: { x: 0.3, y: 0.4, source: 'manual', confirmed: true },
          subnasale: { x: 0.5, y: 0.5, source: 'manual', confirmed: true },
        },
        measurements: [
          {
            id: 'angle',
            name: 'Angle nasofacial',
            value: 28.5,
            unit: '°',
            formula: '∠(N, P, S) × 180 / π',
            landmarks: ['nasion', 'pronasale', 'subnasale'],
            method: 'assisted',
            version: 'profile-2d-2.0.0',
            quality: 'limited',
            samples: 1,
            uncertainties: ['Une capture 2D.'],
          },
        ],
      },
    ],
    multiview: { ...score, version: 'psl-multiview-2.0.0' },
    views: [
      {
        id: 'front',
        view: 'front',
        method: 'automatic',
        source: 'photo',
        observationCount: 1,
        quality: 'limited',
        warnings: ['Une seule photo.'],
        algorithm: 'frontal-2d-1.1.0',
      },
    ],
    recommendations: [
      {
        id: 'r',
        kind: 'capture',
        title: 'Améliorer la lumière',
        objective: 'Réduire les ombres.',
        evidence: ['Une seule photo'],
        rationale: 'Une lumière diffuse aide le repérage.',
        limits: 'Aucun effet garanti.',
      },
    ],
  };
};

async function inspect(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const streams = doc.context
    .enumerateIndirectObjects()
    .flatMap(([, obj]) =>
      obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')
        ? [new TextDecoder().decode(decodePDFRawStream(obj).decode())]
        : [],
    );
  // Text drawn by pdf-lib is hex encoded with WinAnsi; decode to inspect actual content.
  const decodedStreams = streams.map((stream) =>
    stream.replace(/<([0-9A-F]+)>/g, (_, hex: string) =>
      new TextDecoder('windows-1252').decode(
        Uint8Array.from(hex.match(/../g) ?? [], (v) => parseInt(v, 16)),
      ),
    ),
  );
  const text = decodedStreams.join('\n');
  const images = doc.context
    .enumerateIndirectObjects()
    .filter(
      ([, obj]) =>
        obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    );
  return { doc, text, images, decodedStreams };
}

describe('local V2 PDF', () => {
  it.each([
    { includePhotos: false, includeScores: false, includeTechnical: false },
    { includePhotos: false, includeScores: false, includeTechnical: true },
    { includePhotos: false, includeScores: true, includeTechnical: false },
    { includePhotos: false, includeScores: true, includeTechnical: true },
    { includePhotos: true, includeScores: false, includeTechnical: false },
    { includePhotos: true, includeScores: false, includeTechnical: true },
    { includePhotos: true, includeScores: true, includeTechnical: false },
    { includePhotos: true, includeScores: true, includeTechnical: true },
  ])('exports only opted-in PDF data with %j', async (options) => {
    const { text, images, decodedStreams } = await inspect(
      await generateReportPdf(pdfFixture(), options),
    );

    // Descriptive measurements, vector diagrams and source summaries remain available.
    expect(text).toContain('Angle nasofacial : 28.5');
    expect(text).toContain('Constructions frontales');
    expect(text).toContain('Repères confirmés uniquement');
    expect(text).toContain('Source : import local');
    expect(text).toContain('Nasion : manuel, confirmé');
    const profileDiagram = decodedStreams.find((stream) =>
      stream.includes('Repères confirmés uniquement'),
    );
    // The confirmed profile diagram contains its contour, angle strokes and landmark circles.
    expect(profileDiagram?.match(/\nS\n/g)?.length ?? 0).toBeGreaterThan(10);
    expect(profileDiagram?.match(/ c\n/g)?.length ?? 0).toBeGreaterThanOrEqual(12);

    const coordinates = ['x=0.600, y=0.200', 'x=0.300, y=0.400', 'x=0.500, y=0.500'];
    for (const coordinate of coordinates)
      expect(text.includes(coordinate), coordinate).toBe(options.includeTechnical);
    if (options.includeTechnical) {
      expect(text).toContain('coordonnées normalisées');
      expect(text).toContain('180 / pi');
    } else {
      expect(text).not.toContain('coordonnées normalisées');
      expect(text).not.toContain('180 / pi');
    }
    if (options.includeScores) {
      expect(text).toContain('Scores indicatifs');
      expect(text).toContain('7.12 / 8');
    } else {
      expect(text).not.toContain('Scores indicatifs');
      expect(text).not.toContain('7.12');
      expect(text).not.toContain('psl-multiview-2.0.0');
    }
    if (options.includePhotos) expect(images.length).toBeGreaterThan(0);
    else expect(images).toHaveLength(0);
  });
  it('discards a pending scored PDF when scores are masked and clears the previous score choice', async () => {
    let resolve!: (bytes: Uint8Array) => void;
    const pending = new Promise<Uint8Array>((complete) => {
      resolve = complete;
    });
    const generator = vi.spyOn(pdfGenerator, 'generateReportPdf').mockReturnValueOnce(pending);
    const createObjectURL = vi.fn(() => 'blob:masked-score-report');
    const BrowserURL = globalThis.URL;
    vi.stubGlobal(
      'URL',
      class extends BrowserURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      const data = pdfFixture();
      const { rerender } = render(createElement(PDFExportControls, { data, allowScores: true }));
      fireEvent.click(screen.getByRole('checkbox', { name: /scores indicatifs/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
      expect(screen.getByRole('button', { name: /Création du PDF/ })).toBeDisabled();
      rerender(createElement(PDFExportControls, { data, allowScores: false }));
      expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeEnabled();
      expect(screen.getByRole('status')).toHaveTextContent('Export annulé');
      await act(async () => {
        resolve(new Uint8Array([37, 80, 68, 70]));
        await pending;
      });
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeEnabled();
      expect(screen.queryByText('Création locale du PDF…')).not.toBeInTheDocument();
      rerender(createElement(PDFExportControls, { data, allowScores: true }));
      expect(screen.getByRole('checkbox', { name: /scores indicatifs/i })).not.toBeChecked();
    } finally {
      generator.mockRestore();
      click.mockRestore();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('does not download a pending export after its controls unmount on session erase', async () => {
    let resolve!: (bytes: Uint8Array) => void;
    const pending = new Promise<Uint8Array>((complete) => {
      resolve = complete;
    });
    const generator = vi.spyOn(pdfGenerator, 'generateReportPdf').mockReturnValueOnce(pending);
    const createObjectURL = vi.fn(() => 'blob:cancelled-report');
    const BrowserURL = globalThis.URL;
    vi.stubGlobal(
      'URL',
      class extends BrowserURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        createElement(PDFExportControls, { data: pdfFixture(), allowScores: true }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
      expect(screen.getByRole('button', { name: /Création du PDF/ })).toBeDisabled();
      unmount();
      await act(async () => {
        resolve(new Uint8Array([37, 80, 68, 70]));
        await pending;
      });
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
    } finally {
      generator.mockRestore();
      click.mockRestore();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('starts with photos and scores excluded and prevents score export when scores are hidden', () => {
    const { rerender } = render(
      createElement(PDFExportControls, { data: pdfFixture(), allowScores: true }),
    );
    expect(screen.getByRole('checkbox', { name: /photos/i })).not.toBeChecked();
    const scores = screen.getByRole('checkbox', { name: /scores/i });
    expect(scores).not.toBeChecked();
    fireEvent.click(scores);
    expect(scores).toBeChecked();
    rerender(createElement(PDFExportControls, { data: pdfFixture(), allowScores: false }));
    expect(screen.getByRole('checkbox', { name: /scores/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /scores/i })).not.toBeChecked();
  });
  it('generates a real paginated PDF with descriptive content and no photos or scores by default', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    try {
      const bytes = await generateReportPdf(pdfFixture(), {
        includePhotos: false,
        includeScores: false,
        includeTechnical: false,
      });
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      const { doc, text, images } = await inspect(bytes);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
      expect(text).toContain('Synthèse');
      expect(text).toContain('Angle nasofacial');
      expect(text).toContain('Améliorer la lumière');
      expect(text).not.toContain('7.123');
      expect(text).not.toContain('Scores indicatifs');
      expect(text).not.toContain('psl-multiview-2.0.0');
      expect(images).toHaveLength(0);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it('includes selected scores, technical formulas and explicitly opted-in local images', async () => {
    const { text, images } = await inspect(
      await generateReportPdf(pdfFixture(), {
        includePhotos: true,
        includeScores: true,
        includeTechnical: true,
      }),
    );
    expect(text).toContain('Scores indicatifs');
    expect(text).toContain('7.12');
    expect(text).toContain('profile-2d-2.0.0');
    expect(text).toContain('180 / pi');
    expect(images.length).toBeGreaterThan(0);
  });
  it('handles absent frontals, unconfirmed points, invalid remote previews and long text without network access', async () => {
    const data = pdfFixture();
    data.frontal = null;
    data.profiles[0].preview = 'https://example.com/private-photo.jpg';
    data.profiles[0].points.nasion!.confirmed = false;
    data.recommendations[0].rationale = 'éclairage '.repeat(500);
    const { doc, text, images } = await inspect(
      await generateReportPdf(data, {
        includePhotos: true,
        includeScores: false,
        includeTechnical: true,
      }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(4);
    expect(text).toContain('Aucune analyse frontale');
    expect(text).toContain('non confirmé');
    expect(images).toHaveLength(0);
  });
});

it('labels an unavailable observation pose without inventing zero-degree orientation', async () => {
  const data = pdfFixture();
  data.views[0].view = 'orientation-unknown';
  data.views[0].pose = { yaw: 0, pitch: 0, roll: 0, source: 'unavailable' };
  const { text } = await inspect(
    await generateReportPdf(data, {
      includePhotos: false,
      includeScores: false,
      includeTechnical: false,
    }),
  );
  expect(text).toContain('Orientation indisponible');
  expect(text).not.toContain('Pose : lacet 0.0');
});
