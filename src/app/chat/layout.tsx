import type { Metadata } from 'next'
import { Lexend, Nunito } from 'next/font/google'
import { ChatHistorySidebar } from './components/ChatHistorySidebar'
import './styles.css'

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-chat-lexend',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-chat-rounded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

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
    <div className={`flex min-h-screen w-full overflow-hidden bg-background ${lexend.variable} ${nunito.variable}`}>
      <ChatHistorySidebar />
      <main className="flex-1 w-full relative">
        {children}
      </main>
    </div>
  )
}
