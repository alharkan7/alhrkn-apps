import type { Metadata } from 'next'
import { ChatHistorySidebar } from './components/ChatHistorySidebar'

export const metadata: Metadata = {
  title: 'Ask AI',
  description: 'Experimental AI Apps',
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
