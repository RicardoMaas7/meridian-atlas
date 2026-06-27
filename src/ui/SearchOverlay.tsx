import { useI18n } from '../i18n/context'
import type { CodeChart } from '../types'

interface Props {
  query: string
  onQuery: (q: string) => void
  searchMatch: Set<number> | undefined
  chart: CodeChart
  onSelect: (id: number) => void
  onClose: () => void
}

export function SearchOverlay({ query, onQuery, searchMatch, chart, onSelect, onClose }: Props) {
  const { t } = useI18n()
  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          type="text"
          className="search-input"
          placeholder={t.search.placeholder}
          aria-label={t.search.placeholder}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && searchMatch && searchMatch.size > 0) {
              const first = searchMatch.values().next().value
              if (typeof first === 'number') {
                onSelect(first)
              }
            }
          }}
        />
        <div className="search-meta">
          {query && searchMatch && (
            <span>
              {searchMatch.size} {searchMatch.size === 1 ? t.search.result : t.search.results}
            </span>
          )}
        </div>
        {searchMatch && searchMatch.size > 0 && (
          <div className="search-results">
            {Array.from(searchMatch).slice(0, 10).map((id) => {
              const n = chart.nodes.find((nn) => nn.id === id)
              if (!n) return null
              return (
                <button
                  key={id}
                  className="search-result"
                  onClick={() => onSelect(id)}
                >
                  <span className="search-result-name">{n.name}</span>
                  <span className="search-result-file">{n.file}:{n.row}</span>
                </button>
              )
            })}
          </div>
        )}
        {query && searchMatch && searchMatch.size === 0 && (
          <div className="search-empty">{t.search.empty}</div>
        )}
      </div>
    </div>
  )
}
