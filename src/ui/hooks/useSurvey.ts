import { useCallback, useRef, useState } from 'react'
import type { CodeChart, FileEntry } from '../../types'
import { buildChartWithMetrics } from '../../graph/build'
import {
  diffAgainst,
  loadPrevious,
  persist,
  snapshotOf,
  symbolKey,
} from '../../graph/snapshot'
import type { SurveyDelta } from '../../graph/snapshot'
import type { ScanMetric } from './useLastScanMetric'

export type SurveyPhase =
  | { name: 'landing' }
  | { name: 'surveying'; detail: string }
  | { name: 'charted'; chart: CodeChart; title: string; delta: SurveyDelta | null }

export interface SurveyContext {
  phase: SurveyPhase
  setPhase: (p: SurveyPhase) => void
  selectedId: number | null
  setSelectedId: (id: number | null | ((prev: number | null) => number | null)) => void
  /** Run a survey over an already-fetched list of files. */
  runSurvey: (filesPromise: Promise<FileEntry[]>, title: string, silent?: boolean) => Promise<void>
  /** The most recent build metrics (number of files, symbols, duration). */
  lastMetric: ScanMetric | null
  /** True while a build is in flight. */
  busy: boolean
}

/**
 * Owns the survey lifecycle: building the chart, persisting the
 * snapshot, computing the diff against the previous survey, and
 * preserving the selected node across silent resurveys.
 */
export function useSurvey(): SurveyContext {
  const [phase, setPhaseState] = useState<SurveyPhase>({ name: 'landing' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lastMetric, setLastMetric] = useState<ScanMetric | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const surveyingRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const setPhase = useCallback((p: SurveyPhase) => setPhaseState(p), [])

  const survey = useCallback(
    async (files: FileEntry[], title: string, silent: boolean) => {
      if (files.length === 0) {
        if (!silent) setPhaseState({ name: 'landing' })
        return
      }
      const { chart, metrics } = await buildChartWithMetrics(files)
      setLastMetric({
        filesScanned: metrics.filesScanned,
        filesSkipped: metrics.filesSkipped,
        symbolsExtracted: metrics.symbolsExtracted,
        startedAt: metrics.startedAt,
        finishedAt: metrics.finishedAt,
      })
      const previous = loadPrevious(title)
      const delta = previous ? diffAgainst(previous, chart) : null
      persist(snapshotOf(chart, title))

      const current = phaseRef.current
      if (current.name === 'charted' && silent) {
        setSelectedId((sel) => {
          if (sel == null) return sel
          const old = current.chart.nodes.find((n) => n.id === sel)
          if (!old) return null
          return chart.nodes.find((n) => symbolKey(n) === symbolKey(old))?.id ?? null
        })
      } else {
        setSelectedId(null)
      }
      setPhaseState({ name: 'charted', chart, title, delta })
    },
    [],
  )

  const runSurvey = useCallback(
    async (filesPromise: Promise<FileEntry[]>, title: string, silent = false) => {
      if (surveyingRef.current) return
      surveyingRef.current = true
      setBusy(true)
      if (!silent) setPhaseState({ name: 'surveying', detail: '' })
      try {
        const files = await filesPromise
        await survey(files, title, silent)
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.error(err)
        }
        if (!silent) setPhaseState({ name: 'landing' })
      } finally {
        surveyingRef.current = false
        setBusy(false)
      }
    },
    [survey],
  )

  return { phase, setPhase, selectedId, setSelectedId, runSurvey, lastMetric, busy }
}

/**
 * Placeholder hook kept for API parity with the future session-store
 * refactor. The actual session persistence lives in App.tsx for now.
 */
export function useSessionRestore(
  _setPhase: (p: SurveyPhase) => void,
  _setSelectedId: (id: number | null) => void,
): { sessionTitle: string | null; clearSession: () => void } {
  const sessionTitleRef = useRef<string | null>(null)
  const clearSession = useCallback(() => { sessionTitleRef.current = null }, [])
  return { sessionTitle: sessionTitleRef.current, clearSession }
}
