import type { Region } from '../types';
export const regions: { id: Region; name: string }[] = [
  { id: 'all', name: 'Tout le visage' },
  { id: 'face', name: 'Proportions' },
  { id: 'eyes', name: 'Yeux' },
  { id: 'brows', name: 'Sourcils' },
  { id: 'nose', name: 'Nez' },
  { id: 'mouth', name: 'Bouche' },
  { id: 'jaw', name: 'Mâchoire' },
];
