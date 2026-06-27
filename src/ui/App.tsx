import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
import type { CodeChart } from '../types'
import { scanDirectoryHandle, scanFileList } from '../parser/scan'
import { buildExportPayload } from '../graph/exportImport'
import { SPECIMEN_FILES, SPECIMEN_NAME } from '../demo/specimen'
import { ChartCanvas } from './ChartCanvas'
import { SidePanel } from './SidePanel'
import { LanguageSelector } from './LanguageSelector'
import { Tour } from './Tour'
import { Landing } from './Landing'
import { ChartToolbar } from './ChartToolbar'
import { ChartHeader } from './ChartHeader'
import { ChartLegend } from './ChartLegend'
import { SearchOverlay } from './SearchOverlay'
import { HelpOverlay } from './HelpOverlay'
import { ReadyHint } from './ReadyHint'
import { RecentsList } from './RecentsList'
import { ToastContainer } from './ToastContainer'
import { useI18n } from '../i18n/context'
import {
  tauriAvailable,
  pickDirectory,
  scanDirectoryNative,
  exportSnapshot,
  importSnapshot,
  openInEditor,
} from '../native/fs'
import { useTheme } from './hooks/useTheme'
import { useRecents } from './hooks/useRecents'
import { useSurvey, useSessionRestore } from './hooks/useSurvey'
import { useWatcher } from './hooks/useWatcher'
import { useHotkeys } from './hooks/useHotkeys'
import { useNativeMenu } from './hooks/useNativeMenu'
import { pushToast } from './hooks/useToasts'
import { downloadText, downloadBlob, serializeSVG, svgToPng } from './chartExport'
import type { FilterKind } from './filters'

const TOUR_STORAGE_KEY = 'meridian:tour:done'
const SESSION_STORAGE_KEY = 'meridian:session'

interface SessionSnapshot {
  chart: CodeChart
  title: string
  ts: number
  selectedId: number | null
  filterKind: FilterKind
  hideRocks: boolean
  newOnly: boolean
}

export function App() {
  const { t, lang } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const isNative = tauriAvailable()
  const survey = useSurvey()
  const { phase, setPhase, selectedId, setSelectedId, runSurvey, lastMetric } = survey
  const { recents, addRecent, removeRecent } = useRecents()

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const nativeDirRef = useRef<string | null>(null)

  const [filterKind, setFilterKind] = useState<FilterKind>('all')
  const [hideRocks, setHideRocks] = useState(false)
  const [newOnly, setNewOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showRecents, setShowRecents] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [tourHighlight, setTourHighlight] = useState<number | null>(null)
  const [readyHint, setReadyHint] = useState(false)
  const [canWatch, setCanWatch] = useState(false)
  const [watching, setWatching] = useState(false)

  const [hasRestored, setHasRestored] = useState(false)
  useSessionRestore(setPhase, (id) => setSelectedId(id))

  // ---- session restore on first load ----
  useEffect(() => {
    if (hasRestored) return
    setHasRestored(true)
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return
      const session = JSON.parse(raw) as SessionSnapshot
      if (!session?.chart?.nodes?.length) return
      setPhase({ name: 'charted', chart: session.chart, title: session.title, delta: null })
      setSelectedId(session.selectedId ?? null)
      setFilterKind(session.filterKind ?? 'all')
      setHideRocks(session.hideRocks ?? false)
      setNewOnly(session.newOnly ?? false)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- session persist on every charted state ----
  useEffect(() => {
    if (phase.name !== 'charted') return
    const session: SessionSnapshot = {
      chart: phase.chart,
      title: phase.title,
      ts: Date.now(),
      selectedId,
      filterKind,
      hideRocks,
      newOnly,
    }
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } catch {
      // quota
    }
  }, [phase, selectedId, filterKind, hideRocks, newOnly])

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
        addRecent({ name: folderName, path })
        void runSurvey(scanDirectoryNative(path), folderName)
      } catch (err) {
        // eslint-disable-next-line no-console
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
        addRecent({ name: dir.name, path: dir.name })
        void runSurvey(scanDirectoryHandle(dir), dir.name)
      } catch {
        // picker dismissed
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [runSurvey, isNative, addRecent])

  const onFallbackFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      const first = list[0] as File & { webkitRelativePath?: string }
      const root = first.webkitRelativePath?.split('/')[0] ?? 'Local folder'
      dirHandleRef.current = null
      nativeDirRef.current = null
      setCanWatch(false)
      setWatching(false)
      addRecent({ name: root, path: root })
      void runSurvey(scanFileList(list), root)
    },
    [runSurvey, addRecent],
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

  const newChart = useCallback(() => {
    animate('.sheet', { opacity: [1, 0], duration: 320, ease: 'inQuad' })
    setTimeout(() => {
      setPhase({ name: 'landing' })
      setSelectedId(null)
      try { localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* ignore */ }
      animate('.sheet', { opacity: [0, 1], duration: 320, ease: 'outQuad' })
    }, 300)
  }, [setPhase, setSelectedId])

  // ---- watcher ----
  useWatcher(watching, isNative, runSurvey, nativeDirRef, phaseRef)

  // ---- native menu ----
  useNativeMenu(isNative, useMemo(() => ({
    onOpenFolder: openFolder,
    onViewSpecimen: openSpecimen,
    onNewChart: newChart,
    onResurvey: resurvey,
    onAbout: () => pushToast({ kind: 'info', message: t.labels.title, detail: 'A navigational chart of your code.' }),
    onExportChart: () => {
      const c = phaseRef.current
      if (c.name !== 'charted') return
      void exportSnapshot(buildExportPayload(c.chart, c.title))
    },
    onImportChart: () => {
      void (async () => {
        const data = await importSnapshot()
        if (!data) return
        const payload = data as { nodes?: unknown[] }
        pushToast({
          kind: 'info',
          message: t.labels.snapshotImported,
          detail: `${payload.nodes?.length ?? 0} symbols — ${t.labels.snapshotImportedBody}`,
        })
      })()
    },
  }), [openFolder, openSpecimen, newChart, resurvey, t.labels.title]))

  // ---- hotkeys ----
  useHotkeys(
    phaseRef,
    selectedId,
    setSelectedId,
    showSearch,
    setShowSearch,
    showHelp,
    setShowHelp,
    useMemo(() => ({
      onSearch: () => setShowSearch(true),
      onCycleFilter: () => setFilterKind((k) => (k === 'all' ? 'function' : k === 'function' ? 'method' : k === 'method' ? 'class' : 'all')),
      onToggleRocks: () => setHideRocks((v) => !v),
      onToggleNewOnly: () => setNewOnly((v) => !v),
      onToggleHelp: () => setShowHelp((v) => !v),
      onEscape: () => { /* handled in hook too */ },
    }), []),
  )

  // ---- landing animations ----
  useEffect(() => {
    if (phase.name !== 'landing') return
    const el = document.querySelector('.landing')
    if (!el) return
    const targets = el.querySelectorAll('[data-anim]')
    animate(targets, {
      opacity: [0, 1],
      translateY: [40, 0],
      delay: stagger(120, { start: 200 }),
      duration: 1100,
      ease: 'outExpo',
    })
  }, [phase.name])

  useEffect(() => {
    if (phase.name === 'surveying') {
      animate('.surveying', { opacity: [0, 1], scale: [0.95, 1], duration: 600, ease: 'outQuart' })
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

  // ---- first-time tour ----
  useEffect(() => {
    if (phase.name !== 'charted') return
    try {
      const done = localStorage.getItem(TOUR_STORAGE_KEY)
      if (!done) {
        const timer = setTimeout(() => setTourStep(0), 1200)
        return () => clearTimeout(timer)
      }
    } catch { /* ignore */ }
  }, [phase.name])

  // ---- ready hint ----
  useEffect(() => {
    if (!readyHint) return
    const timer = setTimeout(() => setReadyHint(false), 6000)
    return () => clearTimeout(timer)
  }, [readyHint])

  const endTour = useCallback(() => {
    setTourStep(null)
    setTourHighlight(null)
    try { localStorage.setItem(TOUR_STORAGE_KEY, '1') } catch { /* ignore */ }
  }, [])

  const restartTour = useCallback(() => setTourStep(0), [])

  const searchMatch = useMemo(() => {
    if (!search.trim() || phase.name !== 'charted') return undefined
    const q = search.toLowerCase()
    const set = new Set<number>()
    for (const n of phase.chart.nodes) {
      if (n.name.toLowerCase().includes(q) || n.file.toLowerCase().includes(q)) {
        set.add(n.id)
      }
    }
    return set
  }, [search, phase])

  const currentChart = phase.name === 'charted' ? phase.chart : null
  const newIds = useMemo(() => {
    if (!currentChart) return new Set<number>()
    return new Set(phase.name === 'charted' ? (phase.delta?.added.map((n) => n.id) ?? []) : [])
  }, [phase, currentChart])

  const onOpenInEditor = useCallback(async () => {
    if (selectedId == null || !currentChart) return
    const node = currentChart.nodes.find((n) => n.id === selectedId)
    if (!node) return
    const ok = await openInEditor(node.file)
    if (ok) {
      pushToast({ kind: 'success', message: t.labels.openInEditor, detail: node.file, ttlMs: 2200 })
    } else if (!isNative) {
      pushToast({ kind: 'info', message: t.labels.openInEditor, detail: 'Path copied to clipboard.', ttlMs: 2400 })
    } else {
      pushToast({ kind: 'error', message: t.labels.openInEditor, detail: node.file, ttlMs: 3500 })
    }
  }, [selectedId, currentChart, isNative, t.labels.openInEditor])

  return (
    <div className="sheet" data-theme={theme} lang={lang}>
      <div className="grain" />
      <div className="vignette" />

      {phase.name !== 'charted' && (
        <LanguageSelector onToggleTheme={toggleTheme} theme={theme} />
      )}

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
        <Landing
          onOpenFolder={openFolder}
          onOpenSpecimen={openSpecimen}
          onShowRecents={() => setShowRecents(true)}
          recentsCount={recents.length}
          surveying={phase.name === 'surveying' ? phase : null}
        />
      )}

      {phase.name === 'charted' && currentChart && (
        <div className="chart-view">
          <div className="chart-main">
            <LanguageSelector onToggleTheme={toggleTheme} theme={theme} />
            <ChartCanvas
              chart={currentChart}
              selectedId={selectedId}
              newIds={newIds}
              onSelect={setSelectedId}
              onOpenInEditor={onOpenInEditor}
              highlightKind={filterKind === 'all' ? null : filterKind}
              hideRocks={hideRocks}
              newOnly={newOnly}
              searchMatch={searchMatch}
              focusId={tourStep !== null ? tourHighlight : null}
              focusZoom={tourStep === 1 ? 260 : tourStep === 2 ? 280 : tourStep === 3 ? 200 : undefined}
            />
            <ChartToolbar
              filterKind={filterKind}
              setFilterKind={setFilterKind}
              hideRocks={hideRocks}
              setHideRocks={setHideRocks}
              newOnly={newOnly}
              setNewOnly={setNewOnly}
              onRestartTour={restartTour}
              onExportJSON={async () => {
                const c = phaseRef.current
                if (c.name !== 'charted') return
                const payload = buildExportPayload(c.chart, c.title)
                const json = JSON.stringify(payload, null, 2)
                const filename = `meridian-${c.title.replace(/[^a-z0-9_-]+/gi, '_')}-${new Date().toISOString().slice(0, 10)}.json`
                if (isNative) {
                  await exportSnapshot(payload)
                } else {
                  downloadText(json, filename, 'application/json')
                }
                pushToast({ kind: 'success', message: t.labels.exportJSON, detail: filename })
              }}
              onExportSVG={() => {
                const svg = document.querySelector('.chart-svg') as SVGSVGElement | null
                if (!svg) return
                const xml = serializeSVG(svg, theme === 'light' ? '#f2e9d8' : '#05060a')
                const c = phaseRef.current
                if (c.name !== 'charted') return
                const filename = `meridian-${c.title.replace(/[^a-z0-9_-]+/gi, '_')}-${new Date().toISOString().slice(0, 10)}.svg`
                downloadText(xml, filename, 'image/svg+xml')
                pushToast({ kind: 'success', message: t.labels.exportSVG, detail: filename })
              }}
              onExportPNG={async () => {
                const svg = document.querySelector('.chart-svg') as SVGSVGElement | null
                if (!svg) return
                const blob = await svgToPng(svg, { scale: 2, background: theme === 'light' ? '#f2e9d8' : '#05060a' })
                const c = phaseRef.current
                if (c.name !== 'charted') return
                const filename = `meridian-${c.title.replace(/[^a-z0-9_-]+/gi, '_')}-${new Date().toISOString().slice(0, 10)}.png`
                downloadBlob(blob, filename)
                pushToast({ kind: 'success', message: t.labels.exportPNG, detail: filename })
              }}
              onImportJSON={async () => {
                const data = await importSnapshot()
                if (!data) return
                const payload = data as { nodes?: unknown[] }
                pushToast({
                  kind: 'info',
                  message: t.labels.snapshotImported,
                  detail: `${payload.nodes?.length ?? 0} symbols — ${t.labels.snapshotImportedBody}`,
                })
              }}
            />
            <ChartHeader
              title={phase.title}
              chart={currentChart}
              prevGrade={phase.delta?.prevGrade ?? null}
              canWatch={canWatch}
              watching={watching}
              lastMetric={lastMetric}
              onNewChart={newChart}
              onResurvey={resurvey}
              onToggleWatch={() => setWatching((v) => !v)}
            />
            <ChartLegend />
          </div>
          <SidePanel
            chart={currentChart}
            selectedId={selectedId}
            delta={phase.delta}
            onSelect={setSelectedId}
          />
        </div>
      )}

      {showSearch && phase.name === 'charted' && currentChart && (
        <SearchOverlay
          query={search}
          onQuery={setSearch}
          searchMatch={searchMatch}
          chart={currentChart}
          onSelect={(id) => { setSelectedId(id); setShowSearch(false) }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {readyHint && phase.name === 'charted' && (
        <ReadyHint
          onDismiss={() => setReadyHint(false)}
          onTakeTour={() => { setReadyHint(false); restartTour() }}
        />
      )}

      {tourStep !== null && phase.name === 'charted' && currentChart && (
        <Tour
          step={tourStep}
          chart={currentChart}
          onHighlight={(id) => {
            setTourHighlight(id)
            if (id != null) setSelectedId(id)
          }}
          onNext={() => setTourStep((s) => (s == null ? null : s + 1))}
          onBack={() => setTourStep((s) => (s == null ? null : Math.max(0, s - 1)))}
          onSkip={endTour}
          onDone={endTour}
        />
      )}

      <ToastContainer />

      {showRecents && (
        <RecentsList
          recents={recents}
          onPick={async (entry) => {
            setShowRecents(false)
            if (isNative) {
              try {
                nativeDirRef.current = entry.path
                dirHandleRef.current = null
                setCanWatch(true)
                setWatching(false)
                void runSurvey(scanDirectoryNative(entry.path), entry.name)
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error(err)
              }
            } else {
              pushToast({
                kind: 'info',
                message: t.labels.recentsTitle,
                detail: t.labels.recentsNativeOnly,
              })
            }
          }}
          onRemove={removeRecent}
          onClose={() => setShowRecents(false)}
        />
      )}
    </div>
  )
}
