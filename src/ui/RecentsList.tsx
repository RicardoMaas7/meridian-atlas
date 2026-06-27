import { useI18n } from '../i18n/context'
import { relativeTime } from '../graph/snapshot'
import type { RecentEntry } from './hooks/useRecents'

interface Props {
  recents: RecentEntry[]
  onPick: (entry: RecentEntry) => void
  onRemove: (path: string) => void
  onClose: () => void
}

export function RecentsList({ recents, onPick, onRemove, onClose }: Props) {
  const { t } = useI18n()
  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="recents-card" onClick={(e) => e.stopPropagation()}>
        <div className="recents-header">
          <p className="recents-kicker">{t.labels.recentsTitle}</p>
          <button className="recents-close" onClick={onClose} aria-label={t.labels.recentsClose}>×</button>
        </div>
        {recents.length === 0 ? (
          <p className="recents-empty">{t.labels.recentsEmpty}</p>
        ) : (
          <>
            <p className="recents-note">{t.labels.recentsNativeOnly}</p>
            <ul className="recents-list">
              {recents.map((r) => (
                <li key={r.path} className="recents-item">
                  <button
                    className="recents-pick"
                    onClick={() => onPick(r)}
                  >
                    <span className="recents-name">{r.name}</span>
                    <span className="recents-path">{r.path}</span>
                    <span className="recents-time">{relativeTime(r.openedAt)}</span>
                  </button>
                  <button
                    className="recents-remove"
                    onClick={() => onRemove(r.path)}
                    title={t.labels.recentsRemove}
                    aria-label={t.labels.recentsRemove}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
