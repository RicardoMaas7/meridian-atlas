import { useI18n } from '../i18n/context'

interface Props {
  onClose: () => void
}

export function HelpOverlay({ onClose }: Props) {
  const { t } = useI18n()
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t.help.title}</h2>
        <p className="help-intro">{t.help.intro}</p>
        <div className="help-grid">
          <div className="help-section">
            <h3>{t.help.sections.navigation}</h3>
            <div className="help-row"><kbd>drag</kbd><span>{t.help.pan}</span></div>
            <div className="help-row"><kbd>scroll</kbd><span>{t.help.zoom}</span></div>
            <div className="help-row"><kbd>0</kbd><span>{t.help.reset}</span></div>
            <div className="help-row"><kbd>← ↑ → ↓</kbd><span>{t.help.panArrows}</span></div>
            <div className="help-row"><kbd>+ −</kbd><span>{t.help.zoomKeys}</span></div>
          </div>
          <div className="help-section">
            <h3>{t.help.sections.selection}</h3>
            <div className="help-row"><kbd>click</kbd><span>{t.help.select}</span></div>
            <div className="help-row"><kbd>dblclick</kbd><span>{t.labels.openInEditor}</span></div>
            <div className="help-row"><kbd>esc</kbd><span>{t.help.deselect}</span></div>
          </div>
          <div className="help-section">
            <h3>{t.help.sections.searchFilter}</h3>
            <div className="help-row"><kbd>/</kbd><span>{t.help.search}</span></div>
            <div className="help-row"><kbd>F</kbd><span>{t.help.filter}</span></div>
            <div className="help-row"><kbd>H</kbd><span>{t.filters.hideRocks}</span></div>
            <div className="help-row"><kbd>Ctrl N</kbd><span>{t.filters.newOnly}</span></div>
          </div>
          <div className="help-section">
            <h3>{t.help.sections.help}</h3>
            <div className="help-row"><kbd>?</kbd><span>{t.showHelp}</span></div>
            <div className="help-row"><kbd>tour</kbd><span>{t.tourAgain}</span></div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          {t.help.done}
        </button>
      </div>
    </div>
  )
}
