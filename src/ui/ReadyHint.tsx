import { useI18n } from '../i18n/context'

interface Props {
  onDismiss: () => void
  onTakeTour: () => void
}

export function ReadyHint({ onDismiss, onTakeTour }: Props) {
  const { t } = useI18n()
  return (
    <div className="ready-hint" onClick={onDismiss}>
      <div className="ready-hint-kicker">{t.chartReady}</div>
      <div className="ready-hint-body">{t.chartReadyBody}</div>
      <button
        className="ready-hint-tour"
        onClick={(e) => { e.stopPropagation(); onTakeTour() }}
      >
        {t.tourAgain}
      </button>
    </div>
  )
}
