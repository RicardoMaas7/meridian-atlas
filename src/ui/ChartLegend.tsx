import { useI18n } from '../i18n/context'

export function ChartLegend() {
  const { t } = useI18n()
  return (
    <div className="chart-legend" data-anim>
      <div className="legend-title">{t.labels.legend}</div>
      <div className="legend-row">
        <span className="legend-swatch swatch-gold" /> {t.labels.chartedRoute}
      </div>
      <div className="legend-row">
        <span className="legend-swatch swatch-dashed" /> {t.labels.estimatedRoute}
      </div>
      <div className="legend-row">
        <span className="legend-glyph">›</span> {t.labels.arrowDirection}
      </div>
      <div className="legend-row">
        <span className="legend-swatch swatch-crystal" /> {t.labels.symbolSize}
      </div>
      <div className="legend-row">
        <span className="legend-glyph">+</span> {t.labels.rock}
      </div>
      <div className="legend-row">
        <span className="legend-swatch swatch-new" /> {t.labels.filledNew}
      </div>
    </div>
  )
}
