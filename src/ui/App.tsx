import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
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
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNative = tauriAvailable()
  const landingRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
  }, [])

  phaseRef.current = phase

  // Animate landing page
  useEffect(() => {
    if (phase.name !== 'landing' || !landingRef.current) return
    const el = landingRef.current
    const targets = el.querySelectorAll('[data-anim]')
    animate(targets, {
      opacity: [0, 1],
      translateY: [40, 0],
      delay: stagger(120, { start: 200 }),
      duration: 1100,
      ease: 'outExpo',
    })
  }, [phase.name])

  // Animate phase transitions
  useEffect(() => {
    if (phase.name === 'surveying') {
      animate('.surveying', {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 600,
        ease: 'outQuart',
      })
    } else if (phase.name === 'charted') {
      const targets = document.querySelectorAll('.chart-view [data-anim]')
      animate(targets, {
        opacity: [0, 1],
        translateX: [-30, 0],
        delay: stagger(80, { start: 400 }),
        duration: 900,
        ease: 'outQuart',
      })
    }
  }, [phase.name])

  const survey = useCallback(
    async (files: FileEntry[], title: string, silent: boolean) => {
      if (files.length === 0) {
        if (!silent) {
          setPhase({ name: 'landing' })
          animate('.alert', {
            opacity: [0, 1],
            translateY: [-20, 0],
            duration: 400,
            ease: 'outBack',
          })
          if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
          alertTimerRef.current = setTimeout(() => {
            alertTimerRef.current = null
            alert(t.labels.noSupportedFiles)
          }, 200)
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
    nativeDirRef.current = null
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
        animate('.sheet', { opacity: [1, 0], duration: 400, ease: 'inQuad' })
        setTimeout(() => setPhase({ name: 'landing' }), 380)
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

  // Animate selection changes
  useEffect(() => {
    if (phase.name !== 'charted') return
    animate('.titleblock em, .grade-was', {
      scale: [0.85, 1],
      opacity: [0.4, 1],
      duration: 500,
      ease: 'outBack',
    })
  }, [selectedId, phase.name])

  return (
    <div className="sheet">
      <div className="grain" />
      <div className="vignette" />
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
        <div className="landing" ref={landingRef}>
          <div className="landing-mark" data-anim>
            <svg viewBox="0 0 200 200" width="80" height="80">
              <defs>
                <radialGradient id="markGrad" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#f2cf80" stopOpacity="1" />
                  <stop offset="60%" stopColor="#d4a857" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#d4a857" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="60" fill="url(#markGrad)" />
              <circle cx="100" cy="100" r="36" fill="none" stroke="#d4a857" strokeWidth="1" />
              <circle cx="100" cy="100" r="20" fill="none" stroke="#d4a857" strokeWidth="0.6" />
              <line x1="100" y1="20" x2="100" y2="40" stroke="#d4a857" strokeWidth="0.6" />
              <line x1="100" y1="160" x2="100" y2="180" stroke="#d4a857" strokeWidth="0.6" />
              <line x1="20" y1="100" x2="40" y2="100" stroke="#d4a857" strokeWidth="0.6" />
              <line x1="160" y1="100" x2="180" y2="100" stroke="#d4a857" strokeWidth="0.6" />
              <circle cx="100" cy="100" r="3" fill="#f2cf80" />
            </svg>
          </div>
          <p className="kicker" data-anim>{t.labels.kicker}</p>
          <h1 className="display" data-anim>{t.labels.title}</h1>
          <p className="subtitle" data-anim>{t.labels.subtitle}</p>
          <p className="pledge" data-anim>{t.labels.pledge}</p>
          {phase.name === 'landing' ? (
            <div className="actions" data-anim>
              <button className="btn btn-primary" onClick={openFolder}>
                <span>{t.labels.chartFolder}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
                </svg>
              </button>
              <button className="btn btn-ghost" onClick={openSpecimen}>
                {t.labels.viewSpecimen}
              </button>
            </div>
          ) : (
            <div className="surveying" data-anim>
              <div className="surveying-pulse" />
              <p className="surveying-detail">{phase.detail}</p>
              <div className="progress-track">
                <div className="progress-bar" />
              </div>
            </div>
          )}
          <footer className="landing-foot" data-anim>
            <span className="langs">{SUPPORTED_LANGS_LABEL}</span>
            <span className="dot" />
            <span>{t.labels.landingFoot}</span>
            <span className="dot" />
            <a href="https://github.com/RicardoMaas7/meridian">{t.labels.sourceLink}</a>
          </footer>
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
            <div className="chart-titleblock" data-anim>
              <p className="titleblock-kicker">{t.labels.surveyOf}</p>
              <h2>{phase.title}</h2>
              {(() => {
                const { grade } = gradeChart(phase.chart)
                return (
                  <>
                    <div className="stat-row">
                      <div className="stat">
                        <span className="stat-num">{phase.chart.nodes.length}</span>
                        <span className="stat-label">{t.labels.symbols}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-num">{phase.chart.edges.length}</span>
                        <span className="stat-label">{t.labels.routes}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-num">{phase.chart.fileCount}</span>
                        <span className="stat-label">{t.labels.files}</span>
                      </div>
                      <div className="stat stat-grade">
                        <span className="stat-num grade">{grade}</span>
                        <span className="stat-label">{t.labels.seaworthiness}</span>
                      </div>
                    </div>
                    {phase.delta && phase.delta.prevGrade !== grade && (
                      <p className="grade-was">({t.labels.was} {phase.delta.prevGrade})</p>
                    )}
                  </>
                )
              })()}
              <div className="titleblock-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  animate('.sheet', { opacity: [1, 0], duration: 320, ease: 'inQuad' })
                  setTimeout(() => setPhase({ name: 'landing' }), 300)
                }}>
                  {t.labels.newChart}
                </button>
                {canWatch && (
                  <button className="btn btn-ghost btn-sm" onClick={resurvey}>
                    {t.labels.resurvey}
                  </button>
                )}
                {canWatch && (
                  <button
                    className={`btn btn-ghost btn-sm ${watching ? 'btn-active' : ''}`}
                    onClick={() => setWatching((value) => !value)}
                  >
                    <span className={`watch-dot ${watching ? 'watch-on' : ''}`} />
                    {watching ? t.labels.standingWatch : t.labels.keepWatch}
                  </button>
                )}
              </div>
            </div>
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