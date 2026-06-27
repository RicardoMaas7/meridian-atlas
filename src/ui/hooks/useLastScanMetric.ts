import { useEffect, useState } from 'react'

export interface ScanMetric {
  filesScanned: number
  filesSkipped: number
  symbolsExtracted: number
  startedAt: number
  finishedAt: number | null
}

const STORE_KEY = 'meridian:last-scan'

export function useLastScanMetric(): [ScanMetric | null, (m: ScanMetric) => void] {
  const [metric, setMetric] = useState<ScanMetric | null>(() => {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(STORE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      if (metric) localStorage.setItem(STORE_KEY, JSON.stringify(metric))
    } catch {
      // ignore
    }
  }, [metric])
  return [metric, setMetric]
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}
