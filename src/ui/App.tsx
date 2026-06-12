import { useCallback, useEffect, useRef, useState } from 'react'
import type { CodeChart, FileEntry } from '../types'
import { buildChart } from '../graph/build'
import { scanDirectoryHandle, scanFileList } from '../parser/scan'
import { SUPPORTED_LANGS_LABEL } from '../parser/languages'
import {
  diffAgainst,
  gradeChart,
  loadPrevious,
  persist,
  snapshotOf,
  symbolKey,
} from '../graph/snapshot'
import type { SurveyDelta } from '../graph/snapshot'
import { SPECIMEN_FILES, SPECIMEN_NAME } from '../demo/specimen'
import { ChartCanvas } from './ChartCanvas'
import { SidePanel } from './SidePanel'

const WATCH_INTERVAL_MS = 15_000

type Phase =
  | { name: 'landing' }
  | { name: 'surveying'; detail: string }
  | { name: 'charted'; chart: CodeChart; title: string; delta: SurveyDelta | null }

export function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'landing' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const [canWatch, setCanWatch] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const phaseRef = useRef(phase)
  const surveyingRef = useRef(false)
  useEffect(() => {
    phaseRef.current = phase
  })

  const survey = useCallback(
    async (files: FileEntry[], title: string, silent: boolean) => {
      if (files.length === 0) {
        if (!silent) {
          setPhase({ name: 'landing' })
          alert('No supported source files found in that folder.')
        }
        return
      }
      const chart = await buildChart(
        files,
        silent
          ? undefined
          : (done, total) =>
              setPhase({ name: 'surveying', detail: `Taking soundings… ${done}/${total} files` }),
      )

      const previous = loadPrevious(title)
      const delta = previous ? diffAgainst(previous, chart) : null
      persist(snapshotOf(chart, title))

      // Keep the same symbol selected across re-surveys.
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
      setPhase({ name: 'charted', chart, title, delta })
    },
    [],
  )

  const runSurvey = useCallback(
    async (filesPromise: Promise<FileEntry[]>, title: string, silent = false) => {
      if (surveyingRef.current) return
      surveyingRef.current = true
      if (!silent) setPhase({ name: 'surveying', detail: 'Reading the coastline…' })
      try {
        await survey(await filesPromise, title, silent)
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') console.error(err)
        if (!silent) setPhase({ name: 'landing' })
      } finally {
        surveyingRef.current = false
      }
    },
    [survey],
  )

  const openFolder = useCallback(async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dir = await (
          window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
        ).showDirectoryPicker()
        dirHandleRef.current = dir
        setCanWatch(true)
        setWatching(false)
        void runSurvey(scanDirectoryHandle(dir), dir.name)
      } catch {
        // picker dismissed
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [runSurvey])

  const onFallbackFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      const first = list[0] as File & { webkitRelativePath?: string }
      const root = first.webkitRelativePath?.split('/')[0] ?? 'Local folder'
      dirHandleRef.current = null
      setCanWatch(false)
      setWatching(false)
      void runSurvey(scanFileList(list), root)
    },
    [runSurvey],
  )

  const openSpecimen = useCallback(() => {
    dirHandleRef.current = null
    setCanWatch(false)
    setWatching(false)
    void runSurvey(Promise.resolve(SPECIMEN_FILES), SPECIMEN_NAME)
  }, [runSurvey])

  const resurvey = useCallback(() => {
    const dir = dirHandleRef.current
    const current = phaseRef.current
    if (!dir || current.name !== 'charted') return
    void runSurvey(scanDirectoryHandle(dir), current.title, true)
  }, [runSurvey])

  // Standing watch: re-survey the open folder on an interval.
  useEffect(() => {
    if (!watching) return
    const timer = setInterval(resurvey, WATCH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [watching, resurvey])

  return (
    <div className="sheet">
      <div className="frame-scale top" />
      <div className="frame-scale bottom" />
      <div className="frame-scale left" />
      <div className="frame-scale right" />
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        // @ts-expect-error non-standard but universally supported directory attribute
        webkitdirectory=""
        multiple
        onChange={(e) => onFallbackFiles(e.target.files)}
      />

      {phase.name !== 'charted' && (
        <div className="landing">
          <div className="cartouche">
            <p className="cartouche-kicker">A survey of source code</p>
            <h1>Meridian</h1>
            <p className="subtitle">A navigational chart of your code</p>
            <p className="pledge">
              Open a folder. Every function is drawn as a mark, every call as a
              route. <strong>Everything runs in your browser. Nothing leaves
              your machine.</strong>
            </p>
            {phase.name === 'landing' ? (
              <div className="actions">
                <button className="chart-btn" onClick={openFolder}>
                  Chart a folder
                </button>
                <button className="text-btn" onClick={openSpecimen}>
                  View specimen
                </button>
              </div>
            ) : (
              <p className="surveying">{phase.detail}</p>
            )}
          </div>
          <p className="landing-foot">
            {SUPPORTED_LANGS_LABEL} · soundings given in number of calls ·{' '}
            <a href="https://github.com/RicardoMaas7/meridian">source</a>
          </p>
        </div>
      )}

      {phase.name === 'charted' && (
        <div className="chart-view">
          <div className="chart-main">
            <ChartCanvas
              chart={phase.chart}
              selectedId={selectedId}
              newIds={new Set(phase.delta?.added.map((n) => n.id) ?? [])}
              onSelect={setSelectedId}
            />
            <div className="chart-titleblock">
              <p className="titleblock-kicker">Meridian survey of</p>
              <h2>{phase.title}</h2>
              <p className="survey-line">
                <em>{phase.chart.nodes.length}</em> symbols ·{' '}
                <em>{phase.chart.edges.length}</em> routes ·{' '}
                <em>{phase.chart.fileCount}</em> files
              </p>
              <p className="survey-line">
                seaworthiness <em>{gradeChart(phase.chart).grade}</em>
                {phase.delta && phase.delta.prevGrade !== gradeChart(phase.chart).grade && (
                  <span className="grade-was"> (was {phase.delta.prevGrade})</span>
                )}
              </p>
              <div className="titleblock-actions">
                <button className="text-btn" onClick={() => setPhase({ name: 'landing' })}>
                  New chart
                </button>
                {canWatch && (
                  <button className="text-btn" onClick={resurvey}>
                    Re-survey
                  </button>
                )}
                {canWatch && (
                  <button
                    className={`text-btn ${watching ? 'watch-on' : ''}`}
                    onClick={() => setWatching((value) => !value)}
                  >
                    {watching ? 'Standing watch' : 'Keep watch'}
                  </button>
                )}
              </div>
            </div>
            <div className="chart-legend">
              <div className="legend-title">Legend</div>
              <div className="legend-row">
                <span className="legend-swatch" /> charted route (resolved call)
              </div>
              <div className="legend-row">
                <span className="legend-swatch dashed" /> estimated route (by name)
              </div>
              <div className="legend-row">
                <span className="legend-glyph">›</span> arrow = direction of the call
              </div>
              <div className="legend-row">
                <span className="legend-swatch sounding" /> symbol · size = times called
              </div>
              <div className="legend-row">
                <span className="legend-glyph">+</span> rock = never called, calls nothing
              </div>
              <div className="legend-row">
                <span className="legend-swatch sounding new" /> filled = new since last survey
              </div>
            </div>
          </div>
          <SidePanel
            chart={phase.chart}
            selectedId={selectedId}
            delta={phase.delta}
            onSelect={setSelectedId}
          />
        </div>
      )}
    </div>
  )
}
