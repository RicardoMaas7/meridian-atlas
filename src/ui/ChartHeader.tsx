import type { CodeChart } from '../types'
import { gradeChart } from '../graph/snapshot'
import { useI18n } from '../i18n/context'
import { formatDuration, type ScanMetric } from './hooks/useLastScanMetric'

interface Props {
  title: string
  chart: CodeChart
  prevGrade: string | null
  canWatch: boolean
  watching: boolean
  lastMetric: ScanMetric | null
  onNewChart: () => void
  onResurvey: () => void
  onToggleWatch: () => void
}

export function ChartHeader({
  title, chart, prevGrade, canWatch, watching, lastMetric,
  onNewChart, onResurvey, onToggleWatch,
}: Props) {
  const { t } = useI18n()
  const { grade, score } = gradeChart(chart)
  const duration = lastMetric && lastMetric.finishedAt != null
    ? formatDuration(lastMetric.finishedAt - lastMetric.startedAt)
    : null
  return (
    <div className="chart-titleblock" data-anim>
      <p className="titleblock-kicker">{t.labels.surveyOf}</p>
      <h2>{title}</h2>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-num">{chart.nodes.length}</span>
          <span className="stat-label">{t.labels.symbols}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{chart.edges.length}</span>
          <span className="stat-label">{t.labels.routes}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{chart.fileCount}</span>
          <span className="stat-label">{t.labels.files}</span>
        </div>
        <div className="stat stat-grade">
          <span className="stat-num grade">{grade}</span>
          <span className="stat-label">{t.labels.seaworthiness}</span>
        </div>
      </div>
      {prevGrade && prevGrade !== grade && (
        <p className="grade-was">({t.labels.was} {prevGrade} · {score})</p>
      )}
      {lastMetric && (
        <p className="titleblock-log">
          <span>{lastMetric.symbolsExtracted} symbols</span>
          <span className="titleblock-log-sep">·</span>
          <span>{lastMetric.filesScanned} files</span>
          {lastMetric.filesSkipped > 0 && (
            <>
              <span className="titleblock-log-sep">·</span>
              <span className="titleblock-log-warn">{lastMetric.filesSkipped} skipped</span>
            </>
          )}
          <span className="titleblock-log-sep">·</span>
          <span>{duration}</span>
        </p>
      )}
      <div className="titleblock-actions">
        <button className="btn btn-ghost btn-sm" onClick={onNewChart}>
          {t.labels.newChart}
        </button>
        {canWatch && (
          <button className="btn btn-ghost btn-sm" onClick={onResurvey}>
            {t.labels.resurvey}
          </button>
        )}
        {canWatch && (
          <button
            className={`btn btn-ghost btn-sm ${watching ? 'btn-active' : ''}`}
            onClick={onToggleWatch}
          >
            <span className={`watch-dot ${watching ? 'watch-on' : ''}`} />
            {watching ? t.labels.standingWatch : t.labels.keepWatch}
          </button>
        )}
      </div>
    </div>
  )
}
