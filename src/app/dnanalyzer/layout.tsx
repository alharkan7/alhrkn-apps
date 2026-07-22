import type { Metadata } from 'next'
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: 'Automatic Discourse Identifier',
  description: 'Automatically Identify and Highlight Discourse in Text using AI',
  openGraph: {
    title: 'Automatic Discourse Identifier',
    description: 'Automatically Identify and Highlight Discourse in Text using AI',
    images: [`/api/og?title=${encodeURIComponent('Automatic Discourse Identifier')}&description=${encodeURIComponent('Automatically Identify and Highlight Discourse in Text using AI')}&path=dnanalyzer`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Automatic Discourse Identifier',
    description: 'Automatically Identify and Highlight Discourse in Text using AI',
    images: [`/api/og?title=${encodeURIComponent('Automatic Discourse Identifier')}&description=${encodeURIComponent('Automatically Identify and Highlight Discourse in Text using AI')}&path=dnanalyzer`],
  },
}

export default function DNAnalyzerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <main className="container !px-2">
          {children}
        </main>
      </div>
    </Providers>
  )
}