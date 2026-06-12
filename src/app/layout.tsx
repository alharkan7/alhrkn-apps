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

const title = "@alhrkn's Apps Gallery"
const description = "Collection of Experimental AI Apps by @alhrkn"

export const metadata: Metadata = {
  metadataBase: new URL('https://alhrkn.vercel.app'), // Replace with your actual domain
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
  },
  twitter: {
    card: "summary_large_image",
    title: title,
    description: description,
    creator: "@alhrkn",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <style>{`
          .markdown-content h1 {
            font-size: 1.2rem;
            font-weight: bold;
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content h2 {
            font-size: 1.1rem;
            font-weight: bold;
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content h3,
          .markdown-content h4,
          .markdown-content h5,
          .markdown-content h6 {
            font-size: 1rem;
            font-weight: bold;
            margin-top: 0.5rem;
            margin-bottom: 0.25rem;
          }
          .markdown-content p {
            margin-bottom: 0.5rem;
          }
          .markdown-content ul,
          .markdown-content ol {
            margin-top: 0.25rem;
            margin-bottom: 0.5rem;
            padding-left: 1.5rem;
          }
          .markdown-content ul {
            list-style-type: disc;
          }
          .markdown-content ol {
            list-style-type: decimal;
          }
          .markdown-content li {
            margin-bottom: 0.125rem;
          }
          .markdown-content code {
            background-color: rgba(0, 0, 0, 0.05);
            padding: 0.1rem 0.3rem;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
          }
          .markdown-content pre {
            background-color: rgba(0, 0, 0, 0.05);
            padding: 0.5rem;
            border-radius: 5px;
            overflow-x: auto;
            margin: 0.5rem 0;
          }
          .markdown-content blockquote {
            border-left: 3px solid rgba(0, 0, 0, 0.2);
            padding-left: 0.75rem;
            margin: 0.5rem 0;
            font-style: italic;
            color: rgba(0, 0, 0, 0.7);
          }
          .markdown-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.5rem 0;
          }
          .markdown-content th,
          .markdown-content td {
            border: 1px solid rgba(0, 0, 0, 0.2);
            padding: 0.3rem;
            text-align: left;
          }
          .markdown-content th {
            background-color: rgba(0, 0, 0, 0.05);
          }
        `}</style>
      </head>
      <body className={`${spaceGrotesk.className} font-sans`}>
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