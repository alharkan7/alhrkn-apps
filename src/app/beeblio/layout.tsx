import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Beeblio - AI Research Assistant',
  description: 'Search, summarize, and explore academic papers with AI',
  openGraph: {
    title: 'Beeblio - AI Research Assistant',
    description: 'Search, summarize, and explore academic papers with AI',
    images: [`/api/og?title=${encodeURIComponent('Beeblio - AI Research Assistant')}&description=${encodeURIComponent('Search, summarize, and explore academic papers with AI')}&path=beeblio`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Beeblio - AI Research Assistant',
    description: 'Search, summarize, and explore academic papers with AI',
    images: [`/api/og?title=${encodeURIComponent('Beeblio - AI Research Assistant')}&description=${encodeURIComponent('Search, summarize, and explore academic papers with AI')}&path=beeblio`],
  },
}

export default function BeeblioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
