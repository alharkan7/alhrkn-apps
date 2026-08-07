import type { Metadata } from 'next';
import { Lexend, Nunito } from 'next/font/google';
import './styles.css';
import { cn } from '@/lib/utils';
import { PrimerHistorySidebar } from './components/PrimerHistorySidebar';
import { PrimerTopBar } from './components/PrimerTopBar';

// Two reading typefaces that aren't reliably available as system fonts. Exposed
// as CSS variables so the font-cycler CSS can apply them to the lesson body.
const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-primer-lexend',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-primer-rounded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

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
    <div className={cn('min-h-screen bg-background', lexend.variable, nunito.variable)}>
      <PrimerHistorySidebar />
      <PrimerTopBar />
      <main className="relative">{children}</main>
    </div>
  );
}
