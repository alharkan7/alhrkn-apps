import type { Metadata } from 'next';
import { PosterlyHistorySidebar } from './components/PosterlyHistorySidebar';

export const metadata: Metadata = {
  title: 'Posterly — Scientific Posters',
  description: 'Turn a scientific paper into a professional conference poster.',
  openGraph: {
    title: 'Posterly — Scientific Posters',
    description: 'Turn a scientific paper into a professional conference poster.',
    images: [`/api/og?title=${encodeURIComponent('Posterly')}&description=${encodeURIComponent('Turn a scientific paper into a professional conference poster.')}&path=posterly`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Posterly — Scientific Posters',
    description: 'Turn a scientific paper into a professional conference poster.',
  },
};

export default function PosterlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PosterlyHistorySidebar />
      <main className="w-full">{children}</main>
    </div>
  );
}
