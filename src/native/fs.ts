import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { FileEntry } from '../types'

interface SourceFile {
  path: string
  text: string
  lang: string
  is_test?: boolean
  is_generated?: boolean
}

export interface ScanStats {
  total_files: number
  parsed_files: number
  skipped_files: number
  test_files: number
  generated_files: number
  by_language: Record<string, number>
}

const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return (
    '__TAURI_INTERNALS__' in w ||
    '__TAURI__' in w ||
    '_TAURI_INVOKE__' in w
  )
}

export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) return null
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose a folder to chart',
  })
  if (typeof selected === 'string') return selected
  return null
}

export async function scanDirectoryNative(path: string): Promise<FileEntry[]> {
  if (!isTauri()) throw new Error('Native scanning requires Tauri runtime')
  const files = await invoke<SourceFile[]>('scan_directory', { path })
  return files.map((f) => ({
    path: f.path,
    text: f.text,
    lang: f.lang as FileEntry['lang'],
  }))
}

export async function computeStats(files: Array<{ path: string; text: string; lang: string }>): Promise<ScanStats> {
  if (!isTauri()) {
    return computeStatsFallback(files)
  }
  return await invoke<ScanStats>('compute_stats', { files })
}

function computeStatsFallback(files: Array<{ path: string; text: string; lang: string }>): ScanStats {
  const stats: ScanStats = {
    total_files: files.length,
    parsed_files: 0,
    skipped_files: 0,
    test_files: 0,
    generated_files: 0,
    by_language: {},
  }
  for (const f of files) {
    stats.by_language[f.lang] = (stats.by_language[f.lang] ?? 0) + 1
    const p = f.path.toLowerCase().replace(/\\/g, '/')
    if (p.includes('__tests__') || p.includes('/test/') || p.includes('/tests/')
        || p.includes('test_') || p.includes('.test.') || p.includes('.spec.')) {
      stats.test_files++
    }
    if (f.text.length > 0) stats.parsed_files++
    else stats.skipped_files++
  }
  return stats
}

export async function getAppInfo(): Promise<{ version: string; name: string; platform: string; arch?: string }> {
  if (!isTauri()) {
    return { version: 'web', name: 'Meridian (web)', platform: 'browser' }
  }
  return await invoke('get_app_info')
}

export async function exportSnapshot(payload: unknown): Promise<boolean> {
  if (!isTauri()) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meridian-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  }
  const path = await save({
    title: 'Export chart snapshot',
    defaultPath: `meridian-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!path) return false
  await invoke('export_snapshot', { path, payload })
  return true
}

export async function importSnapshot(): Promise<unknown | null> {
  if (!isTauri()) {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json,.json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(null); return }
        try {
          const text = await file.text()
          resolve(JSON.parse(text))
        } catch {
          resolve(null)
        }
      }
      input.click()
    })
  }
  const path = await open({
    title: 'Import chart snapshot',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    multiple: false,
  })
  if (typeof path !== 'string') return null
  return await invoke('import_snapshot', { path })
}

export async function openInEditor(path: string): Promise<boolean> {
  if (!isTauri()) {
    try {
      await navigator.clipboard.writeText(path)
    } catch {
      // ignore
    }
    return false
  }
  try {
    await invoke('open_in_editor', { path })
    return true
  } catch {
    return false
  }
}

export async function watchSnapshot(root: string): Promise<Record<string, number>> {
  if (!isTauri()) return {}
  return await invoke<Record<string, number>>('watch_snapshot', { root })
}

export async function getMtimes(paths: string[]): Promise<Record<string, number>> {
  if (!isTauri()) return {}
  return await invoke<Record<string, number>>('get_mtimes', { paths })
}

export const tauriAvailable = isTauri
