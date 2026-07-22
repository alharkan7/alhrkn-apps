import type { Metadata } from 'next'
import { OutlinerHistorySidebar } from './components/OutlinerHistorySidebar'

export const metadata: Metadata = {
  title: 'Outliner',
  description: 'AI Research Outliner',
  openGraph: {
    title: 'Outliner',
    description: 'AI Research Outliner',
    images: [`/api/og?title=${encodeURIComponent('Outliner')}&description=${encodeURIComponent('AI Research Outliner')}&path=outliner`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Outliner',
    description: 'AI Research Outliner',
    images: [`/api/og?title=${encodeURIComponent('Outliner')}&description=${encodeURIComponent('AI Research Outliner')}&path=outliner`],
  },
}

export default function OutlinerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <OutlinerHistorySidebar />
      <main className="w-full">
        {children}
      </main>
    </div>
  )
}