import { useEffect, useState } from 'react'
import { scanDirectoryNative, watchSnapshot } from '../../native/fs'
import type { SurveyPhase } from './useSurvey'

const WATCH_INTERVAL_MS = 15_000

/**
 * Polls the filesystem for changes while `enabled` is true. The polling
 * itself only runs in the Tauri runtime; on the web there is no way to
 * watch a directory the user picked through `showDirectoryPicker`, so
 * `lastSnapshot` will stay empty and the effect is a no-op.
 */
export function useWatcher(
  enabled: boolean,
  isNative: boolean,
  runSurvey: (files: Promise<import('../../types').FileEntry[]>, title: string, silent?: boolean) => Promise<void>,
  nativeDirRef: React.MutableRefObject<string | null>,
  phaseRef: React.MutableRefObject<SurveyPhase>,
) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !isNative) {
      setActive(false)
      return
    }
    setActive(true)
    let cancelled = false
    let lastSnapshot: Record<string, number> = {}
    const tick = async () => {
      if (cancelled) return
      const root = nativeDirRef.current
      if (!root) return
      let current: Record<string, number> = {}
      try {
        current = await watchSnapshot(root)
      } catch {
        // ignore — directory may be temporarily unavailable
      }
      if (cancelled) return
      const changed =
        Object.keys(current).length !== Object.keys(lastSnapshot).length ||
        Object.entries(current).some(([k, v]) => lastSnapshot[k] !== v) ||
        Object.keys(lastSnapshot).some((k) => !(k in current))
      lastSnapshot = current
      if (changed) {
        const c = phaseRef.current
        if (c.name === 'charted') {
          await runSurvey(scanDirectoryNative(root), c.title, true)
        }
      }
    }
    void tick()
    const timer = setInterval(tick, WATCH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, isNative, runSurvey, nativeDirRef, phaseRef])

  return active
}
