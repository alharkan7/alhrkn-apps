"use client"

import * as React from "react"
import { useServerInsertedHTML } from "next/navigation"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeContextValue = {
  theme: Theme | undefined
  setTheme: (theme: Theme | ((prev: Theme | undefined) => Theme)) => void
  resolvedTheme: ResolvedTheme | undefined
  themes: string[]
  systemTheme: ResolvedTheme | undefined
  forcedTheme?: string
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: undefined,
      setTheme: () => {},
      resolvedTheme: undefined,
      themes: ["light", "dark"],
      systemTheme: undefined,
    }
  }
  return ctx
}

export type ThemeProviderProps = {
  children: React.ReactNode
  attribute?: "class" | `data-${string}`
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  storageKey?: string
  forcedTheme?: Theme
}

/**
 * Drop-in replacement for next-themes that injects the FOUC-prevention script
 * via useServerInsertedHTML (outside the client React tree), avoiding React 19's
 * "Encountered a script tag while rendering React component" warning.
 */
export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  storageKey = "theme",
  forcedTheme,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(forcedTheme ?? defaultTheme)
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>("light")
  const [mounted, setMounted] = React.useState(false)

  // Inject theme bootstrap script outside React's client render tree
  useServerInsertedHTML(() => {
    const script = `
(function(){
  try {
    var storageKey = ${JSON.stringify(storageKey)};
    var defaultTheme = ${JSON.stringify(defaultTheme)};
    var enableSystem = ${JSON.stringify(enableSystem)};
    var forcedTheme = ${JSON.stringify(forcedTheme ?? null)};
    var d = document.documentElement;
    var t = forcedTheme || localStorage.getItem(storageKey) || defaultTheme;
    var m = window.matchMedia('(prefers-color-scheme: dark)');
    var system = m.matches ? 'dark' : 'light';
    var r = (t === 'system' && enableSystem) ? system : (t === 'dark' || t === 'light' ? t : (defaultTheme === 'system' ? system : defaultTheme));
    d.classList.remove('light', 'dark');
    ${attribute === "class"
      ? "d.classList.add(r);"
      : `d.setAttribute(${JSON.stringify(attribute)}, r);`}
    d.style.colorScheme = r;
  } catch (e) {}
})();`.replace(/\n\s*/g, "")

    return (
      <script
        key="alhrkn-theme-init"
        dangerouslySetInnerHTML={{ __html: script }}
      />
    )
  })

  React.useEffect(() => {
    setMounted(true)
    if (forcedTheme) {
      setThemeState(forcedTheme)
      return
    }
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored)
      }
    } catch {
      // ignore
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystem = () => setSystemTheme(mq.matches ? "dark" : "light")
    updateSystem()
    mq.addEventListener("change", updateSystem)
    return () => mq.removeEventListener("change", updateSystem)
  }, [storageKey, forcedTheme])

  const resolvedTheme: ResolvedTheme =
    (forcedTheme === "dark" || forcedTheme === "light"
      ? forcedTheme
      : theme === "system"
        ? systemTheme
        : theme) as ResolvedTheme

  React.useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (attribute === "class") {
      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)
    } else {
      root.setAttribute(attribute, resolvedTheme)
    }
    root.style.colorScheme = resolvedTheme
    if (!forcedTheme) {
      try {
        localStorage.setItem(storageKey, theme)
      } catch {
        // ignore
      }
    }
  }, [theme, resolvedTheme, mounted, attribute, storageKey, forcedTheme])

  const setTheme = React.useCallback(
    (next: Theme | ((prev: Theme | undefined) => Theme)) => {
      if (forcedTheme) return
      setThemeState((prev) => {
        const value = typeof next === "function" ? next(prev) : next
        return value
      })
    },
    [forcedTheme]
  )

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme: mounted ? theme : undefined,
      setTheme,
      resolvedTheme: mounted ? resolvedTheme : undefined,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
      systemTheme: mounted ? systemTheme : undefined,
      forcedTheme,
    }),
    [theme, setTheme, resolvedTheme, enableSystem, systemTheme, mounted, forcedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
