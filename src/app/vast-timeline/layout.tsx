import type { Metadata } from 'next'
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: 'Nusantara Timeline',
  description: 'Visualize Vast Timeline in an Interactive Way',
}

export default function VastTimelineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <main className="w-full">
          {children}
        </main>
      </div>
    </Providers>
  )
}