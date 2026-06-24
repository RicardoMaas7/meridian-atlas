import { useI18n } from '../i18n/context'
import { tauriAvailable } from '../native/fs'

export function LanguageSelector() {
  const { lang, setLang } = useI18n()
  const isNative = tauriAvailable()

  return (
    <div className="top-controls">
      <span className="platform-pill" data-native={isNative ? 'true' : 'false'}>
        <span className="platform-dot" />
        {isNative ? 'desktop' : 'web'}
      </span>
      <div className="lang-selector" role="group" aria-label="Language">
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          title="English"
          aria-pressed={lang === 'en'}
        >
          EN
        </button>
        <button
          className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
          onClick={() => setLang('es')}
          title="Español"
          aria-pressed={lang === 'es'}
        >
          ES
        </button>
      </div>
    </div>
  )
}
