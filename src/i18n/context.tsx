import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Language, Translations } from './translations'
import { translations } from './translations'

interface I18nContextValue {
  lang: Language
  t: Translations
  setLang: (lang: Language) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'meridian:lang'

function getInitialLang(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
  } catch {
    // fall through to default
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLang)

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      // storage unavailable
    }
  }

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}