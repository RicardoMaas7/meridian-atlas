import { useI18n } from '../i18n/context'
import { tauriAvailable } from '../native/fs'

export function LanguageSelector() {
  const { lang, setLang, t } = useI18n()
  const isNative = tauriAvailable()

  return (
    <div className="top-controls">
      <span className="platform-badge" title={isNative ? t.labels.nativeApp : t.labels.webApp}>
        {isNative ? '● Desktop' : '○ Web'}
      </span>
      <div className="lang-selector">
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          title="English"
        >
          EN
        </button>
        <button
          className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
          onClick={() => setLang('es')}
          title="Español"
        >
          ES
        </button>
      </div>
    </div>
  )
}