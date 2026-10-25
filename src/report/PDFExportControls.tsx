import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReportData } from '../types/v2';
import { generateReportPdf } from './generateReportPdf';

/** Privacy choices apply to this export only; no image is included automatically. */
export function PDFExportControls({
  data,
  allowScores,
}: {
  data: ReportData;
  allowScores: boolean;
}) {
  const [includePhotos, setIncludePhotos] = useState(false);
  const [includeScores, setIncludeScores] = useState(false);
  const [includeTechnical, setIncludeTechnical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [previousAllowScores, setPreviousAllowScores] = useState(allowScores);
  const mounted = useRef(false);
  const operation = useRef<{ includeScores: boolean } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (allowScores) return;
    // Revoke a pending scored export synchronously with the mask's commit.
    // The generator may finish, but its operation token can no longer download.
    if (operation.current?.includeScores) {
      operation.current = null;
    }
  }, [allowScores]);

  // Reset choices and presentation together when the parent revokes scores.
  // Adjusting state during this render avoids briefly painting stale controls.
  if (previousAllowScores !== allowScores) {
    setPreviousAllowScores(allowScores);
    if (!allowScores) {
      setIncludeScores(false);
      if (busy && includeScores) {
        setBusy(false);
        setStatus('Export annulé : les scores ont été masqués.');
        setError('');
      }
    }
  }

  const download = async () => {
    if (busy || !mounted.current) return;
    const token = { includeScores: allowScores && includeScores };
    operation.current = token;
    const isCurrent = () => mounted.current && operation.current === token;
    setBusy(true);
    setError('');
    setStatus('Création locale du PDF…');
    try {
      const bytes = await generateReportPdf(data, {
        includePhotos,
        includeScores: token.includeScores,
        includeTechnical,
      });
      // Generation is in memory and cannot be interrupted. Discard its output if
      // the session was erased or these controls were removed while awaiting it.
      if (!isCurrent()) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'psl-lens-rapport.pdf';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Give the browser time to consume the in-memory download before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus('PDF créé. Le téléchargement a été demandé au navigateur.');
    } catch {
      if (!isCurrent()) return;
      setStatus('');
      setError('Le PDF n’a pas pu être créé. Réessayez en désactivant les photos.');
    } finally {
      if (isCurrent()) {
        operation.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <section className="panel pdf-export-controls" aria-label="Export PDF local">
      <span className="eyebrow">VOTRE RAPPORT À CONSERVER</span>
      <h3>Télécharger le rapport PDF</h3>
      <p className="small muted">
        Le document est créé sur cet appareil. Les photos et les scores sont exclus par défaut.
      </p>
      <fieldset
        disabled={busy}
        style={{
          display: 'grid',
          gap: '0.75rem',
          margin: '1rem 0',
          padding: '1rem',
          border: '1px solid currentColor',
          borderRadius: '0.75rem',
        }}
      >
        <legend>Contenu du PDF</legend>
        <label>
          <input
            type="checkbox"
            checked={includePhotos}
            onChange={(event) => setIncludePhotos(event.target.checked)}
          />{' '}
          Inclure les photos locales
        </label>
        <label>
          <input
            type="checkbox"
            checked={allowScores && includeScores}
            disabled={!allowScores}
            onChange={(event) => setIncludeScores(event.target.checked)}
          />{' '}
          Inclure les scores indicatifs{!allowScores && ' (masqués dans le rapport)'}
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeTechnical}
            onChange={(event) => setIncludeTechnical(event.target.checked)}
          />{' '}
          Inclure l’annexe technique : formules et versions
        </label>
      </fieldset>
      <button type="button" className="button primary" disabled={busy} onClick={download}>
        {busy ? 'Création du PDF…' : 'Télécharger le PDF'}
      </button>
      {status && (
        <p role="status" className="small">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="small">
          {error}
        </p>
      )}
    </section>
  );
}

export default PDFExportControls;
