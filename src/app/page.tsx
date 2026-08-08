'use client'

import { apps, type AppConfig } from '@/config/apps'
import Link from 'next/link'
import { ArrowRight, Github, Twitter, Instagram, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { useTheme } from '@/components/theme-provider'

function AppCard({ app }: { app: AppConfig }) {
  const IconComponent = app.icon
  const isExternal = app.slug.startsWith('http')
  const href = isExternal ? app.slug : app.slug ? `/${app.slug}` : '/'

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="group relative block h-[8.25rem] sm:h-auto"
    >
      <SpotlightCard spotlightColor="rgba(25, 25, 24, 0.055)" className="h-full overflow-hidden rounded-2xl border-black/[0.07] bg-white/76 p-3 shadow-[0_6px_24px_rgba(25,25,24,0.045)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-black/[0.12] hover:bg-white hover:shadow-[0_12px_34px_rgba(25,25,24,0.08)] dark:border-white/[0.08] dark:bg-[#191917]/76 dark:shadow-[0_8px_26px_rgba(0,0,0,0.2)] dark:hover:border-white/[0.13] dark:hover:bg-[#1d1d1b] dark:hover:shadow-[0_14px_38px_rgba(0,0,0,0.3)] sm:p-6">
        {/* Mobile: left text + right icon, fixed height. Desktop: stacked layout. */}
        <div className="flex flex-row-reverse sm:flex-col items-start gap-2 sm:gap-0 h-full">
          <div className="flex items-center justify-between w-auto sm:w-full shrink-0 mb-0 sm:mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl border border-black/[0.055] bg-black/[0.04] text-black/48 transition-colors group-hover:bg-black/[0.075] group-hover:text-black/75 dark:border-white/[0.065] dark:bg-white/[0.055] dark:text-white/48 dark:group-hover:bg-white/[0.09] dark:group-hover:text-white/75 sm:size-12">
              <IconComponent className="size-4 sm:size-5" />
            </div>
            <ArrowRight className="hidden size-5 -translate-x-2 text-black/30 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-black/60 group-hover:opacity-100 dark:text-white/30 dark:group-hover:text-white/60 sm:block" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col overflow-hidden h-full sm:h-auto">
            <h3 className="mb-1 line-clamp-2 shrink-0 text-base font-semibold leading-snug tracking-[-0.02em] transition-colors sm:mb-2 sm:text-xl sm:line-clamp-none">
              {app.name}
            </h3>
            <p className="max-h-[4.875em] overflow-y-auto text-xs leading-relaxed text-black/45 [scrollbar-width:none] [-ms-overflow-style:none] dark:text-white/45 sm:max-h-none sm:overflow-visible sm:text-sm [&::-webkit-scrollbar]:hidden">
              {app.description}
            </p>
          </div>
        </div>
      </SpotlightCard>
    </Link>
  )
}

function AppsGrid({ items }: { items: AppConfig[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {items.map((app) => (
        <AppCard key={app.slug} app={app} />
      ))}
    </div>
  )
}

export default function HomePage() {
  const { theme, setTheme } = useTheme()
  const academicApps = apps.filter((app) => app.type === 'academic')
  const otherApps = apps.filter((app) => app.type !== 'academic')

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f3f3f0] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.98),rgba(243,243,240,0.76)_48%,rgba(235,235,231,0.84)_100%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(38,38,35,0.74),rgba(16,16,15,1)_56%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:19px_19px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)] dark:opacity-[0.09] dark:[background-image:radial-gradient(rgba(255,255,255,0.36)_0.7px,transparent_0.7px)]" />
        <div className="absolute left-1/2 top-4 h-64 w-[42rem] max-w-[90vw] -translate-x-1/2 rounded-full bg-white/45 blur-3xl dark:bg-white/[0.025]" />
      </div>

      <section className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden px-4 pb-0 pt-20 text-center sm:pt-24">
        <div className="relative z-10 mx-auto max-w-3xl space-y-5">
          {/* <a 
            href="https://raihankalla.id" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center rounded-full border border-black/[0.07] bg-white/65 px-3 py-1 text-xs font-medium text-black/50 shadow-sm backdrop-blur-lg transition-colors hover:bg-white hover:text-black dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/50 dark:hover:bg-white/[0.09] dark:hover:text-white"
            aria-label="Visit raihankalla.id (opens in new tab)" 
          > 
            raihankalla.id 
          </a>  */}
 
          <h1 className="text-balance text-4xl font-semibold leading-[1.2] tracking-[-0.055em] sm:text-5xl sm:leading-[1] md:text-6xl">
            Research &amp; Learning Apps
          </h1>
          <p className="mx-auto max-w-[620px] text-sm leading-relaxed text-black/48 dark:text-white/48 sm:text-base">
            Experimental tools by <a href="https://raihankalla.id" target="_blank" rel="noopener noreferrer" className="font-medium text-black/70 underline decoration-black/20 underline-offset-4 hover:text-black dark:text-white/70 dark:decoration-white/20 dark:hover:text-white">@alhrkn</a>.
          </p>
        </div>
      </section>

      {/* Apps Grid */}
      <section id="apps" className="relative z-10 mx-auto w-full max-w-5xl space-y-12 px-4 py-12 sm:px-6 md:py-16">
        <AppsGrid items={academicApps} />

        {otherApps.length > 0 && (
          <>
            <div className="flex items-center gap-4" role="separator" aria-label="More apps">
              <div className="h-px flex-1 bg-black/[0.07] dark:bg-white/[0.08]" />
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-black/38 dark:text-white/38">
                More apps
              </span>
              <div className="h-px flex-1 bg-black/[0.07] dark:bg-white/[0.08]" />
            </div>

            <AppsGrid items={otherApps} />
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-black/[0.055] bg-[#f3f3f0]/55 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#10100f]/55">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} Al Harkan. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/alhrkn" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </a>
            <a href="https://Instagram.com/alhrkn" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Instagram className="h-5 w-5" />
              <span className="sr-only">Instagram</span>
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
