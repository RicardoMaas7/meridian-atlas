import { useI18n } from '../i18n/context'

interface Props {
  onExportJSON: () => void
  onExportSVG: () => void
  onExportPNG: () => void
  onImportJSON: () => void
  onRestartTour: () => void
}

export function ExportToolbar({
  onExportJSON, onExportSVG, onExportPNG, onImportJSON, onRestartTour,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="export-toolbar" data-anim>
      <button className="chip" onClick={onExportJSON} title={t.labels.exportJSON} aria-label={t.labels.exportJSON}>
        <svg viewBox="0 0 14 14" width="11" height="11" fill="none" aria-hidden="true">
          <path d="M7 1v9M3 7l4 4 4-4M2 13h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        </svg>
        <span>JSON</span>
      </button>
      <button className="chip" onClick={onExportSVG} title={t.labels.exportSVG} aria-label={t.labels.exportSVG}>
        <svg viewBox="0 0 14 14" width="11" height="11" fill="none" aria-hidden="true">
          <path d="M7 1v9M3 7l4 4 4-4M2 13h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        </svg>
        <span>SVG</span>
      </button>
      <button className="chip" onClick={onExportPNG} title={t.labels.exportPNG} aria-label={t.labels.exportPNG}>
        <svg viewBox="0 0 14 14" width="11" height="11" fill="none" aria-hidden="true">
          <path d="M7 1v9M3 7l4 4 4-4M2 13h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        </svg>
        <span>PNG</span>
      </button>
      <button className="chip" onClick={onImportJSON} title={t.labels.importJSON} aria-label={t.labels.importJSON}>
        <svg viewBox="0 0 14 14" width="11" height="11" fill="none" aria-hidden="true">
          <path d="M7 13V4M3 7l4-4 4 4M2 1h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        </svg>
        <span>JSON</span>
      </button>
      <span className="export-toolbar-sep" />
      <button className="chip chip-help" onClick={onRestartTour} title={t.labels.restartTour} aria-label={t.labels.restartTour}>?</button>
    </div>
  )
}
