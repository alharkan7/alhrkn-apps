export const POSTER_STYLES = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean white space, restrained color, and strong hierarchy.',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Warm paper tones, refined typography, and journal-like detail.',
  },
  {
    id: 'dark',
    label: 'Dark mode',
    description: 'High-contrast charcoal canvas with vivid research highlights.',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    description: 'Technical grid, cool blue accents, and an engineering feel.',
  },
] as const;

export type PosterStyle = (typeof POSTER_STYLES)[number]['id'];
export type PosterStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface PosterlyArtifactUrls {
  html?: string;
  pdf?: string;
  png?: string;
}

export interface PosterlyHistoryItem {
  id: string;
  title: string;
  sourceFileName: string;
  style: PosterStyle | string | null;
  status: PosterStatus;
  createdAt: string;
}
