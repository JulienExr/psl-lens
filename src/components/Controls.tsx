import { ShieldCheck, LoaderCircle } from 'lucide-react';
import type { Region } from '../types';
import type { Layer } from './Mesh';
import { regions } from './regions';
export function LayerControls({
  layer,
  onLayer,
  region,
  onRegion,
}: {
  layer: Layer;
  onLayer: (l: Layer) => void;
  region: Region;
  onRegion: (r: Region) => void;
}) {
  return (
    <div className="overlay-controls">
      <div className="segmented" aria-label="Couche de visualisation">
        {(
          [
            { id: 'video', name: 'Vidéo' },
            { id: 'points', name: 'Repères' },
            { id: 'mesh', name: 'Maillage' },
            { id: 'measurements', name: 'Mesures' },
          ] as const
        ).map((l) => (
          <button key={l.id} aria-pressed={layer === l.id} onClick={() => onLayer(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <label className="select-label">
        Zone observée
        <select value={region} onChange={(e) => onRegion(e.target.value as Region)}>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function LocalNotice() {
  return (
    <div className="local-notice">
      <ShieldCheck size={16} />
      <span>Vos images restent dans votre navigateur.</span>
      <span className="mono">LOCAL PROCESSING</span>
    </div>
  );
}
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="loading">
      <LoaderCircle className="spin" size={20} />
      {children}
    </div>
  );
}
