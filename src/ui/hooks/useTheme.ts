import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'
const STORAGE_KEY = 'meridian:theme'
const DEFAULT_MODE: ThemeMode = 'dark'

function readStored(): ThemeMode {
  if (typeof localStorage === 'undefined') return DEFAULT_MODE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'light' ? 'light' : 'dark'
  } catch {
    return DEFAULT_MODE
  }
}

/**
 * Drives a `data-theme` attribute on the document element. The CSS layer
 * (styles.css) overrides the dark defaults with the parchment palette
 * when `data-theme="light"`. Returns the current mode plus a toggle.
 */
export function useTheme(): { theme: ThemeMode; toggleTheme: () => void; setTheme: (m: ThemeMode) => void } {
  const [theme, setThemeState] = useState<ThemeMode>(readStored)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore quota errors
    }
  }, [theme])

  const setTheme = useCallback((m: ThemeMode) => setThemeState(m), [])
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggleTheme, setTheme }
}
