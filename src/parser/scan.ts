import type { FileEntry } from '../types'
import { langForPath, langForPathWithContent } from './loader'

export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-mcp',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  'vendor',
  '.cache',
  '.turbo',
])

export const MAX_FILES = 4000
export const MAX_FILE_BYTES = 1_500_000

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
      continue
    }
    // First pass: extension-only detection so we can skip unsupported
    // files without reading them.
    if (!langForPath(handle.name)) continue
    let file: File
    try {
      file = await (handle as FileSystemFileHandle).getFile()
    } catch {
      continue
    }
    if (file.size > MAX_FILE_BYTES) continue
    let text: string
    try {
      text = await file.text()
    } catch {
      continue
    }
    // Second pass: refine the language for ambiguous extensions like .h
    // (could be C or C++) by peeking at the content.
    const lang = langForPathWithContent(path, text)
    if (!lang) continue
    entries.push({ path, text, lang })
    onProgress?.(entries.length)
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
    if (!langForPath(file.name)) continue
    if (file.size > MAX_FILE_BYTES) continue
    let text: string
    try {
      text = await file.text()
    } catch {
      continue
    }
    const lang = langForPathWithContent(path, text)
    if (!lang) continue
    entries.push({ path, text, lang })
    onProgress?.(entries.length)
  }
  return entries
}
