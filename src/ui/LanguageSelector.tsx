import { useI18n } from '../i18n/context'
import { tauriAvailable } from '../native/fs'

interface Props {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function LanguageSelector({ theme, onToggleTheme }: Props) {
  const { t, lang, setLang } = useI18n()
  const isNative = tauriAvailable()

  return (
    <div className="top-controls">
      <span className="platform-pill" data-native={isNative ? 'true' : 'false'}>
        <span className="platform-dot" />
        {isNative ? t.labels.nativeApp : t.labels.webApp}
      </span>
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={t.labels.themeToggle}
        aria-label={t.labels.themeToggle}
        data-theme-icon={theme}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M11 8.5a4.5 4.5 0 0 1-4-7 5 5 0 1 0 6 6 4.5 4.5 0 0 1-2 1z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <line x1="8" y1="1.5" x2="8" y2="3" />
              <line x1="8" y1="13" x2="8" y2="14.5" />
              <line x1="1.5" y1="8" x2="3" y2="8" />
              <line x1="13" y1="8" x2="14.5" y2="8" />
              <line x1="3.2" y1="3.2" x2="4.3" y2="4.3" />
              <line x1="11.7" y1="11.7" x2="12.8" y2="12.8" />
              <line x1="3.2" y1="12.8" x2="4.3" y2="11.7" />
              <line x1="11.7" y1="4.3" x2="12.8" y2="3.2" />
            </g>
          </svg>
        )}
      </button>
      <div className="lang-selector" role="group" aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          title={lang === 'es' ? 'Inglés' : 'English'}
          aria-pressed={lang === 'en'}
          aria-label={lang === 'es' ? 'Cambiar a inglés' : 'Switch to English'}
        >
          EN
        </button>
        <button
          className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
          onClick={() => setLang('es')}
          title={lang === 'es' ? 'Español' : 'Spanish'}
          aria-pressed={lang === 'es'}
          aria-label={lang === 'es' ? 'Cambiar a español' : 'Switch to Spanish'}
        >
          ES
        </button>
      </div>
    </div>
  )
}
