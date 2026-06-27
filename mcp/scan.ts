import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { FileEntry } from '../src/types'
import { langForPath, langForPathWithContent } from '../src/parser/languages'
import { MAX_FILE_BYTES, MAX_FILES, SKIP_DIRS } from '../src/parser/scan'

/** Node counterpart of scanDirectoryHandle: same skip list, same limits. */
export function scanDirectory(root: string): FileEntry[] {
  const entries: FileEntry[] = []
  walk(root, '', entries)
  return entries
}

function walk(dir: string, prefix: string, entries: FileEntry[]): void {
  if (entries.length >= MAX_FILES) return
  let dirents
  try {
    dirents = readdirSync(dir, { withFileTypes: true })
  } catch {
    return // unreadable directory: leave it off the chart
  }
  for (const entry of dirents) {
    if (entries.length >= MAX_FILES) return
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full, path, entries)
    } else if (entry.isFile()) {
      if (!langForPath(entry.name)) continue
      let size: number
      try {
        size = statSync(full).size
      } catch {
        continue
      }
      if (size > MAX_FILE_BYTES) continue
      let text: string
      try {
        text = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      const lang = langForPathWithContent(path, text)
      if (!lang) continue
      entries.push({ path, text, lang })
    }
  }
}
