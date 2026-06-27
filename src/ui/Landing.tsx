import { useI18n } from '../i18n/context'
import { SUPPORTED_LANGS_LABEL } from '../parser/languages'

interface Props {
  onOpenFolder: () => void
  onOpenSpecimen: () => void
  onShowRecents: () => void
  recentsCount: number
  surveying: { detail: string } | null
}

export function Landing({ onOpenFolder, onOpenSpecimen, onShowRecents, recentsCount, surveying }: Props) {
  const { t } = useI18n()
  return (
    <div className="landing">
      <div className="landing-mark" data-anim>
        <svg viewBox="0 0 200 200" width="80" height="80" aria-hidden="true">
          <defs>
            <radialGradient id="markGrad" cx="50%" cy="50%">
              <stop offset="0%" stopColor="var(--gold-bright)" stopOpacity="1" />
              <stop offset="60%" stopColor="var(--gold)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="60" fill="url(#markGrad)" />
          <circle cx="100" cy="100" r="36" fill="none" stroke="var(--gold)" strokeWidth="1" />
          <circle cx="100" cy="100" r="20" fill="none" stroke="var(--gold)" strokeWidth="0.6" />
          <line x1="100" y1="20" x2="100" y2="40" stroke="var(--gold)" strokeWidth="0.6" />
          <line x1="100" y1="160" x2="100" y2="180" stroke="var(--gold)" strokeWidth="0.6" />
          <line x1="20" y1="100" x2="40" y2="100" stroke="var(--gold)" strokeWidth="0.6" />
          <line x1="160" y1="100" x2="180" y2="100" stroke="var(--gold)" strokeWidth="0.6" />
          <line x1="35" y1="35" x2="48" y2="48" stroke="var(--gold)" strokeWidth="0.4" opacity="0.5" />
          <line x1="165" y1="35" x2="152" y2="48" stroke="var(--gold)" strokeWidth="0.4" opacity="0.5" />
          <line x1="35" y1="165" x2="48" y2="152" stroke="var(--gold)" strokeWidth="0.4" opacity="0.5" />
          <line x1="165" y1="165" x2="152" y2="152" stroke="var(--gold)" strokeWidth="0.4" opacity="0.5" />
          <circle cx="100" cy="100" r="3" fill="var(--gold-bright)" />
        </svg>
      </div>
      <p className="kicker" data-anim>{t.labels.kicker}</p>
      <h1 className="display" data-anim>{t.labels.title}</h1>
      <p className="subtitle" data-anim>{t.labels.subtitle}</p>
      <p className="pledge" data-anim>{t.labels.pledge}</p>

      {surveying === null ? (
        <div className="actions" data-anim>
          <button className="btn btn-primary" onClick={onOpenFolder}>
            <span>{t.labels.chartFolder}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
            </svg>
          </button>
          <button className="btn btn-ghost" onClick={onOpenSpecimen}>
            {t.labels.viewSpecimen}
          </button>
          {recentsCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={onShowRecents}>
              {recentsCount} {t.labels.recents}
            </button>
          )}
        </div>
      ) : (
        <div className="surveying" data-anim>
          <div className="surveying-pulse" />
          <p className="surveying-detail">{surveying.detail}</p>
          <div className="progress-track">
            <div className="progress-bar" />
          </div>
        </div>
      )}

      <footer className="landing-foot" data-anim>
        <span className="langs">{SUPPORTED_LANGS_LABEL}</span>
        <span className="dot" />
        <span>{t.labels.landingFoot}</span>
        <span className="dot" />
        <a href="https://github.com/RicardoMaas7/meridian">{t.labels.sourceLink}</a>
      </footer>
    </div>
  )
}
