import type { Metadata } from 'next'
import { PapermapHistorySidebar } from './components/PapermapHistorySidebar'

export const metadata: Metadata = {
  title: 'Papermap',
  description: 'Learn Anything with Interactive AI Mindmap',
  openGraph: {
    title: 'Papermap',
    description: 'Learn Anything with Interactive AI Mindmap',
    images: [`/api/og?title=${encodeURIComponent('Papermap')}&description=${encodeURIComponent('Learn Anything with Interactive AI Mindmap')}&path=papermap`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Papermap',
    description: 'Learn Anything with Interactive AI Mindmap',
    images: [`/api/og?title=${encodeURIComponent('Papermap')}&description=${encodeURIComponent('Learn Anything with Interactive AI Mindmap')}&path=papermap`],
  },
}

export default function PapermapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <PapermapHistorySidebar />
      <main className="w-full">
        {children}
      </main>
    </div>
  )
}
