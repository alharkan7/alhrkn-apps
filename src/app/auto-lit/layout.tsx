import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Auto Lit - AI Research Assistant',
  description: 'Search, summarize, and explore academic papers with AI',
  openGraph: {
    title: 'Auto Lit - AI Research Assistant',
    description: 'Search, summarize, and explore academic papers with AI',
    images: [`/api/og?title=${encodeURIComponent('Auto Lit - AI Research Assistant')}&description=${encodeURIComponent('Search, summarize, and explore academic papers with AI')}&path=auto-lit`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Auto Lit - AI Research Assistant',
    description: 'Search, summarize, and explore academic papers with AI',
    images: [`/api/og?title=${encodeURIComponent('Auto Lit - AI Research Assistant')}&description=${encodeURIComponent('Search, summarize, and explore academic papers with AI')}&path=auto-lit`],
  },
}

export default function AutoLitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
