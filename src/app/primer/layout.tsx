import type { Metadata } from 'next';
import './styles.css';
import { PrimerHistorySidebar } from './components/PrimerHistorySidebar';
import { PrimerTopBar } from './components/PrimerTopBar';

export const metadata: Metadata = {
  title: 'Primer',
  description: 'Learn Anything via Interactive Lessons',
  openGraph: {
    title: 'Primer',
    description: 'Learn Anything via Interactive Lessons',
    images: [
      `/api/og?title=${encodeURIComponent('Primer')}&description=${encodeURIComponent('Learn Anything via Interactive Lessons')}&path=primer`,
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Primer',
    description: 'Learn Anything via Interactive Lessons',
    images: [
      `/api/og?title=${encodeURIComponent('Primer')}&description=${encodeURIComponent('Learn Anything via Interactive Lessons')}&path=primer`,
    ],
  },
};

export default function PrimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <PrimerHistorySidebar />
      <PrimerTopBar />
      <main className="relative">{children}</main>
    </div>
  );
}
