import type { FileEntry } from '../types'
import { langForPath } from './loader'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  'vendor',
  '.cache',
  '.turbo',
])

const MAX_FILES = 4000
const MAX_FILE_BYTES = 1_500_000

export async function scanDirectoryHandle(
  dir: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void,
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  await walk(dir, '', entries, onProgress)
  return entries
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  entries: FileEntry[],
  onProgress?: (count: number) => void,
): Promise<void> {
  if (entries.length >= MAX_FILES) return
  for await (const handle of dir.values()) {
    if (entries.length >= MAX_FILES) return
    const path = prefix ? `${prefix}/${handle.name}` : handle.name
    if (handle.kind === 'directory') {
      if (!SKIP_DIRS.has(handle.name) && !handle.name.startsWith('.')) {
        await walk(handle as FileSystemDirectoryHandle, path, entries, onProgress)
      }
    } else {
      const lang = langForPath(handle.name)
      if (!lang) continue
      const file = await (handle as FileSystemFileHandle).getFile()
      if (file.size > MAX_FILE_BYTES) continue
      entries.push({ path, text: await file.text(), lang })
      onProgress?.(entries.length)
    }
  }
}

/** Fallback for browsers without showDirectoryPicker: <input type="file" webkitdirectory>. */
export async function scanFileList(
  files: FileList,
  onProgress?: (count: number) => void,
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  for (const file of Array.from(files)) {
    if (entries.length >= MAX_FILES) break
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    // Drop the root folder segment so paths match the directory-handle scan.
    const path = rel.includes('/') ? rel.slice(rel.indexOf('/') + 1) : rel
    if (path.split('/').some((seg) => SKIP_DIRS.has(seg) || seg.startsWith('.'))) continue
    const lang = langForPath(file.name)
    if (!lang) continue
    if (file.size > MAX_FILE_BYTES) continue
    entries.push({ path, text: await file.text(), lang })
    onProgress?.(entries.length)
  }
  return entries
}
