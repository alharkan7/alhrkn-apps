import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { Space_Grotesk } from 'next/font/google';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const title = "Research & Learning Apps"
const description = "Experimental Tools by @alhrkn"

export const metadata: Metadata = {
  metadataBase: new URL('https://apps.raihankalla.id'), // Replace with your actual domain
  title: title,
  description: description,
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: title,
    description: description,
    type: "website",
    locale: "en_US",
    siteName: title,
    images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`],
  },
  twitter: {
    card: "summary_large_image",
    title: title,
    description: description,
    creator: "@alhrkn",
    images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} font-sans`} suppressHydrationWarning>
        <TooltipProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-center"/>
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
