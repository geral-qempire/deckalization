export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "deckalization-theme"

/** Resolve the OS-level colour-scheme preference. Defaults to dark on the server. */
export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Read a previously persisted theme, or null if none/invalid. */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : null
}

/** Stored preference wins; otherwise follow the OS. */
export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

/** Toggle the `dark` class on <html> to match the given theme. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", theme === "dark")
}

/**
 * Synchronous, self-contained snippet injected into <head> before paint to set
 * the `dark` class from localStorage / system preference, avoiding a flash of
 * the wrong theme on first load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`
