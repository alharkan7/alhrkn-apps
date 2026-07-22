import type { Metadata } from 'next'
import { InztagramHistorySidebar } from './components/InztagramHistorySidebar'

export const metadata: Metadata = {
  title: 'Inztagram - Instant Diagram',
  description: 'Create Any Diagram in Seconds with AI',
  openGraph: {
    title: 'Inztagram - Instant Diagram',
    description: 'Create Any Diagram in Seconds with AI',
    images: [`/api/og?title=${encodeURIComponent('Inztagram - Instant Diagram')}&description=${encodeURIComponent('Create Any Diagram in Seconds with AI')}&path=inztagram`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Inztagram - Instant Diagram',
    description: 'Create Any Diagram in Seconds with AI',
    images: [`/api/og?title=${encodeURIComponent('Inztagram - Instant Diagram')}&description=${encodeURIComponent('Create Any Diagram in Seconds with AI')}&path=inztagram`],
  },
}

export default function InztagramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <InztagramHistorySidebar />
      <main className="container !px-2">
        {children}
      </main>
    </div>
  )
}