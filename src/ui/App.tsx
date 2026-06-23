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
import { LanguageSelector } from './LanguageSelector'
import { useI18n } from '../i18n/context'
import { tauriAvailable, pickDirectory, scanDirectoryNative } from '../native/fs'
import { listen } from '@tauri-apps/api/event'

const WATCH_INTERVAL_MS = 15_000

type Phase =
  | { name: 'landing' }
  | { name: 'surveying'; detail: string }
  | { name: 'charted'; chart: CodeChart; title: string; delta: SurveyDelta | null }

export function App() {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>({ name: 'landing' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const [canWatch, setCanWatch] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const nativeDirRef = useRef<string | null>(null)
  const phaseRef = useRef(phase)
  const surveyingRef = useRef(false)
  const isNative = tauriAvailable()

  useEffect(() => {
    phaseRef.current = phase
  })

  const survey = useCallback(
    async (files: FileEntry[], title: string, silent: boolean) => {
      if (files.length === 0) {
        if (!silent) {
          setPhase({ name: 'landing' })
          alert(t.labels.noSupportedFiles)
        }
        return
      }
      const chart = await buildChart(
        files,
        silent
          ? undefined
          : (done, total) =>
              setPhase({ name: 'surveying', detail: `${t.labels.takingSoundings} ${done}/${total} files` }),
      )

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
      setPhase({ name: 'charted', chart, title, delta })
    },
    [t],
  )

  const runSurvey = useCallback(
    async (filesPromise: Promise<FileEntry[]>, title: string, silent = false) => {
      if (surveyingRef.current) return
      surveyingRef.current = true
      if (!silent) setPhase({ name: 'surveying', detail: t.labels.readingCoastline })
      try {
        await survey(await filesPromise, title, silent)
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') console.error(err)
        if (!silent) setPhase({ name: 'landing' })
      } finally {
        surveyingRef.current = false
      }
    },
    [survey, t],
  )

  const openFolder = useCallback(async () => {
    if (isNative) {
      try {
        const path = await pickDirectory()
        if (!path) return
        nativeDirRef.current = path
        dirHandleRef.current = null
        setCanWatch(true)
        setWatching(false)
        const folderName = path.split(/[\\/]/).filter(Boolean).pop() ?? path
        void runSurvey(scanDirectoryNative(path), folderName)
      } catch (err) {
        console.error('Failed to open directory:', err)
      }
    } else if ('showDirectoryPicker' in window) {
      try {
        const dir = await (
          window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
        ).showDirectoryPicker()
        dirHandleRef.current = dir
        nativeDirRef.current = null
        setCanWatch(true)
        setWatching(false)
        void runSurvey(scanDirectoryHandle(dir), dir.name)
      } catch {
        // picker dismissed
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [runSurvey, isNative])

  const onFallbackFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      const first = list[0] as File & { webkitRelativePath?: string }
      const root = first.webkitRelativePath?.split('/')[0] ?? 'Local folder'
      dirHandleRef.current = null
      nativeDirRef.current = null
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
    const current = phaseRef.current
    if (current.name !== 'charted') return
    if (nativeDirRef.current) {
      void runSurvey(scanDirectoryNative(nativeDirRef.current), current.title, true)
    } else if (dirHandleRef.current) {
      void runSurvey(scanDirectoryHandle(dirHandleRef.current), current.title, true)
    }
  }, [runSurvey])

  useEffect(() => {
    if (!watching) return
    const timer = setInterval(resurvey, WATCH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [watching, resurvey])

  // Listen for native menu events from Tauri
  useEffect(() => {
    if (!isNative) return
    let unlisten: (() => void) | undefined
    listen<string>('menu', (event) => {
      const action = event.payload
      if (action === 'open_folder') {
        void openFolder()
      } else if (action === 'view_specimen') {
        openSpecimen()
      } else if (action === 'new_chart') {
        setPhase({ name: 'landing' })
      } else if (action === 'resurvey') {
        resurvey()
      } else if (action === 'about') {
        alert(`${t.labels.title}\nA navigational chart of your code.\nNative desktop app.`)
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [isNative, t.labels.title, openFolder, openSpecimen, resurvey])

  return (
    <div className="sheet">
      <div className="frame-scale top" />
      <div className="frame-scale bottom" />
      <div className="frame-scale left" />
      <div className="frame-scale right" />
      <LanguageSelector />
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
            <p className="cartouche-kicker">{t.labels.kicker}</p>
            <h1>{t.labels.title}</h1>
            <p className="subtitle">{t.labels.subtitle}</p>
            <p className="pledge">{t.labels.pledge}</p>
            {phase.name === 'landing' ? (
              <div className="actions">
                <button className="chart-btn" onClick={openFolder}>
                  {t.labels.chartFolder}
                </button>
                <button className="text-btn" onClick={openSpecimen}>
                  {t.labels.viewSpecimen}
                </button>
              </div>
            ) : (
              <p className="surveying">{phase.detail}</p>
            )}
          </div>
          <p className="landing-foot">
            {SUPPORTED_LANGS_LABEL} · {t.labels.landingFoot} ·{' '}
            <a href="https://github.com/RicardoMaas7/meridian">{t.labels.sourceLink}</a>
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
              <p className="titleblock-kicker">{t.labels.surveyOf}</p>
              <h2>{phase.title}</h2>
              <p className="survey-line">
                <em>{phase.chart.nodes.length}</em> {t.labels.symbols} ·{' '}
                <em>{phase.chart.edges.length}</em> {t.labels.routes} ·{' '}
                <em>{phase.chart.fileCount}</em> {t.labels.files}
              </p>
              <p className="survey-line">
                {t.labels.seaworthiness} <em>{gradeChart(phase.chart).grade}</em>
                {phase.delta && phase.delta.prevGrade !== gradeChart(phase.chart).grade && (
                  <span className="grade-was"> ({t.labels.was} {phase.delta.prevGrade})</span>
                )}
              </p>
              <div className="titleblock-actions">
                <button className="text-btn" onClick={() => setPhase({ name: 'landing' })}>
                  {t.labels.newChart}
                </button>
                {canWatch && (
                  <button className="text-btn" onClick={resurvey}>
                    {t.labels.resurvey}
                  </button>
                )}
                {canWatch && (
                  <button
                    className={`text-btn ${watching ? 'watch-on' : ''}`}
                    onClick={() => setWatching((value) => !value)}
                  >
                    {watching ? t.labels.standingWatch : t.labels.keepWatch}
                  </button>
                )}
              </div>
            </div>
            <div className="chart-legend">
              <div className="legend-title">{t.labels.legend}</div>
              <div className="legend-row">
                <span className="legend-swatch" /> {t.labels.chartedRoute}
              </div>
              <div className="legend-row">
                <span className="legend-swatch dashed" /> {t.labels.estimatedRoute}
              </div>
              <div className="legend-row">
                <span className="legend-glyph">›</span> {t.labels.arrowDirection}
              </div>
              <div className="legend-row">
                <span className="legend-swatch sounding" /> {t.labels.symbolSize}
              </div>
              <div className="legend-row">
                <span className="legend-glyph">+</span> {t.labels.rock}
              </div>
              <div className="legend-row">
                <span className="legend-swatch sounding new" /> {t.labels.filledNew}
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