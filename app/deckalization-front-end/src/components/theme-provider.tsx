import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { Theme } from "@/lib/theme"
import { THEME_STORAGE_KEY, applyTheme, resolveInitialTheme } from "@/lib/theme"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Match the server-rendered default so hydration is stable; the no-flash
  // script has already set the real class on <html>. We reconcile in an effect.
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    setThemeState(resolveInitialTheme())
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark"
      applyTheme(next)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      }
      return next
    })
  }, [])

  return (
    <ThemeContext value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
  return ctx
}
