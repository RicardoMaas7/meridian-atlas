import { useCallback, useState } from 'react'

const STORAGE_KEY = 'meridian:recents'
const MAX_RECENTS = 6

export interface RecentEntry {
  /** Display name (last segment of the path, or webkit root). */
  name: string
  /** Full path for Tauri, or root folder for web picker. */
  path: string
  /** When this folder was last opened. */
  openedAt: number
}

function readRecents(): RecentEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r): r is RecentEntry =>
        typeof r === 'object' && r !== null &&
        typeof r.name === 'string' && typeof r.path === 'string' && typeof r.openedAt === 'number'
      )
      .slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

function writeRecents(recents: RecentEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)))
  } catch {
    // ignore quota
  }
}

export function useRecents(): {
  recents: RecentEntry[]
  addRecent: (entry: Omit<RecentEntry, 'openedAt'>) => void
  removeRecent: (path: string) => void
  clearRecents: () => void
} {
  const [recents, setRecents] = useState<RecentEntry[]>(readRecents)

  const addRecent = useCallback((entry: Omit<RecentEntry, 'openedAt'>) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.path !== entry.path)
      const next: RecentEntry[] = [{ ...entry, openedAt: Date.now() }, ...filtered].slice(0, MAX_RECENTS)
      writeRecents(next)
      return next
    })
  }, [])

  const removeRecent = useCallback((path: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.path !== path)
      writeRecents(next)
      return next
    })
  }, [])

  const clearRecents = useCallback(() => {
    setRecents([])
    writeRecents([])
  }, [])

  return { recents, addRecent, removeRecent, clearRecents }
}
