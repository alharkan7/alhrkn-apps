import type { Metadata } from 'next'
import { AnimaChartHistorySidebar } from './components/AnimaChartHistorySidebar'

export const metadata: Metadata = {
  title: 'Motion Charts',
  description: 'Turn boring chart images into animated charts, downloadable as videos.',
}

export default function AnimaChartLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AnimaChartHistorySidebar />
      <main className="container !px-0 sm:!px-2 max-w-full">
        {children}
      </main>
    </div>
  )
}
