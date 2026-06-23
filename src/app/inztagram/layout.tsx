import type { Metadata } from 'next'
import { InztagramHistorySidebar } from './components/InztagramHistorySidebar'

export const metadata: Metadata = {
  title: 'Inztagram - Instant Diagram',
  description: 'Create Any Diagram in Seconds with AI',
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