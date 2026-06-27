import type { FilterKind } from './filters'
import { useI18n } from '../i18n/context'

interface Props {
  filterKind: FilterKind
  setFilterKind: (k: FilterKind) => void
  hideRocks: boolean
  setHideRocks: (v: boolean | ((p: boolean) => boolean)) => void
  newOnly: boolean
  setNewOnly: (v: boolean | ((p: boolean) => boolean)) => void
  onRestartTour: () => void
  onExportJSON: () => void
  onExportSVG: () => void
  onExportPNG: () => void
  onImportJSON: () => void
}

export function ChartToolbar({
  filterKind, setFilterKind,
  hideRocks, setHideRocks,
  newOnly, setNewOnly,
  onRestartTour,
  onExportJSON, onExportSVG, onExportPNG, onImportJSON,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="chart-toolbar" data-anim>
      <div className="toolbar-group">
        <span className="toolbar-label">{t.filters.title}:</span>
        <button
          className={`chip ${filterKind === 'all' ? 'active' : ''}`}
          onClick={() => setFilterKind('all')}
        >
          {t.filters.all}
        </button>
        <button
          className={`chip ${filterKind === 'function' ? 'active' : ''}`}
          onClick={() => setFilterKind('function')}
        >
          {t.filters.functions}
        </button>
        <button
          className={`chip ${filterKind === 'method' ? 'active' : ''}`}
          onClick={() => setFilterKind('method')}
        >
          {t.filters.methods}
        </button>
        <button
          className={`chip ${filterKind === 'class' ? 'active' : ''}`}
          onClick={() => setFilterKind('class')}
        >
          {t.filters.classes}
        </button>
        <button
          className={`chip ${hideRocks ? 'active' : ''}`}
          onClick={() => setHideRocks((v) => !v)}
        >
          {hideRocks ? t.filters.showRocks : t.filters.hideRocks}
        </button>
        <button
          className={`chip ${newOnly ? 'active' : ''}`}
          onClick={() => setNewOnly((v) => !v)}
        >
          {t.filters.newOnly}
        </button>
      </div>
      <div className="toolbar-group">
        <button className="chip" onClick={onExportJSON} title={t.labels.exportJSON} aria-label={t.labels.exportJSON}>↓ JSON</button>
        <button className="chip" onClick={onExportSVG} title={t.labels.exportSVG} aria-label={t.labels.exportSVG}>↓ SVG</button>
        <button className="chip" onClick={onExportPNG} title={t.labels.exportPNG} aria-label={t.labels.exportPNG}>↓ PNG</button>
        <button className="chip" onClick={onImportJSON} title={t.labels.importJSON} aria-label={t.labels.importJSON}>↑ JSON</button>
        <button className="chip icon" onClick={onRestartTour} title={t.labels.restartTour} aria-label={t.labels.restartTour}>?</button>
      </div>
    </div>
  )
}
