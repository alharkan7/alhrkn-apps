'use client'

import { apps } from '@/config/apps'
import Link from 'next/link'
import { ArrowRight, Github, Twitter, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { useTheme } from 'next-themes'

export default function HomePage() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center w-full pt-16 pb-0 px-4 text-center bg-gradient-to-b from-background to-muted/20 overflow-hidden">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        <div className="space-y-4 max-w-3xl mx-auto relative z-10">
          <a 
            href="https://raihankalla.id" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="shiny-link inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80" 
            aria-label="Visit raihankalla.id (opens in new tab)" 
          > 
            raihankalla.id 
          </a> 
 
          <style jsx>{`
            .shiny-link {
              position: relative;
              overflow: hidden;
              isolation: isolate;
              border-radius: 9999px;
              box-shadow: inset 0 0 0 1px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.10);
            }
            .shiny-link::before {
              content: "";
              position: absolute;
              top: -80%;
              left: -85%;
              width: 55%;
              height: 260%;
              background: linear-gradient(
                90deg,
                rgba(255,255,255,0) 0%,
                rgba(255,255,255,0.82) 42%,
                rgba(255,255,255,1) 50%,
                rgba(255,255,255,0.82) 58%,
                rgba(255,255,255,0) 100%
              );
              box-shadow: 0 0 14px rgba(255,255,255,0.55);
              transform: rotate(24deg);
              opacity: 0;
              pointer-events: none;
              z-index: 2;
              will-change: left, opacity;
            }
            .shiny-link::after {
              content: "";
              position: absolute;
              inset: 0;
              border-radius: inherit;
              background-image:
                linear-gradient(
                  120deg,
                  rgba(255,255,255,0.22) 0%,
                  rgba(255,255,255,0) 48%,
                  rgba(0,0,0,0.14) 100%
                ),
                repeating-linear-gradient(
                  135deg,
                  rgba(255,255,255,0.15) 0px,
                  rgba(255,255,255,0.15) 1px,
                  rgba(255,255,255,0) 1px,
                  rgba(255,255,255,0) 4px
                );
              opacity: 0;
              transition: opacity 180ms ease-out;
              pointer-events: none;
              z-index: 1;
            }
            .shiny-link:hover::after,
            .shiny-link:focus-visible::after {
              opacity: 0.34;
            }
            @keyframes shiny-sweep {
              0% {
                left: -85%;
                opacity: 0;
              }
              12% {
                opacity: 0.98;
              }
              100% {
                left: 155%;
                opacity: 0;
              }
            }
            .shiny-link:hover::before,
            .shiny-link:focus-visible::before {
              animation: shiny-sweep 1100ms cubic-bezier(.2,.9,.3,1) 1 both;
            }
            :global(.dark) .shiny-link::before {
              box-shadow: 0 0 18px rgba(255,255,255,0.72);
            }
            :global(.dark) .shiny-link {
              box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 2px 10px rgba(0,0,0,0.42);
            }
            :global(.dark) .shiny-link:hover::after,
            :global(.dark) .shiny-link:focus-visible::after {
              opacity: 0.26;
            }
          `}</style>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Mini <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Apps</span> Gallery
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-base">
            A collection of experimental apps by <a href="https://raihankalla.id" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4 hover:text-primary">@alhrkn</a>.
          </p>
        </div>
      </section>

      {/* Apps Grid */}
      <section id="apps" className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const IconComponent = app.icon
            const isExternal = app.slug.startsWith('http')
            const href = isExternal ? app.slug : app.slug ? `/${app.slug}` : '/'

            return (
              <Link
                key={app.slug}
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="group relative block h-full"
              >
                <SpotlightCard className="h-full p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/50 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-cyan-500 group-hover:text-white">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight mb-2 group-hover:text-primary transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {app.description}
                  </p>
                </SpotlightCard>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/40">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} Al Harkan. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/alhrkn" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </a>
            <a href="https://github.com/alharkan7" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
            <div className="h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
