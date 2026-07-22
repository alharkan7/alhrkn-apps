import type { Metadata } from 'next'
import { ChatHistorySidebar } from './components/ChatHistorySidebar'

export const metadata: Metadata = {
  title: 'Ask AI',
  description: 'Experimental Apps by @alhrkn',
  openGraph: {
    title: 'Ask AI',
    description: 'Experimental Apps by @alhrkn',
    images: [`/api/og?title=${encodeURIComponent('Ask AI')}&description=${encodeURIComponent('Experimental Apps by @alhrkn')}&path=chat`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'Ask AI',
    description: 'Experimental Apps by @alhrkn',
    images: [`/api/og?title=${encodeURIComponent('Ask AI')}&description=${encodeURIComponent('Experimental Apps by @alhrkn')}&path=chat`],
  },
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background w-full overflow-hidden">
      <ChatHistorySidebar />
      <main className="flex-1 w-full relative">
        {children}
      </main>
    </div>
  )
}
