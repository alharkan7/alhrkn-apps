import type { Metadata } from 'next'
import { OutlinerHistorySidebar } from './components/OutlinerHistorySidebar'

export const metadata: Metadata = {
  title: 'Outliner',
  description: 'AI Research Outliner',
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