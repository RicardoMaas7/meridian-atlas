import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { FileEntry } from '../types'

interface SourceFile {
  path: string
  text: string
  lang: string
}

const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) {
    return null
  }
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose a folder to chart',
  })
  if (typeof selected === 'string') {
    return selected
  }
  return null
}

export async function scanDirectoryNative(path: string): Promise<FileEntry[]> {
  if (!isTauri()) {
    throw new Error('Native scanning requires Tauri runtime')
  }
  const files = await invoke<SourceFile[]>('scan_directory', { path })
  return files.map((f) => ({
    path: f.path,
    text: f.text,
    lang: f.lang as FileEntry['lang'],
  }))
}

export async function getAppInfo(): Promise<{ version: string; name: string; platform: string }> {
  if (!isTauri()) {
    return { version: 'web', name: 'Meridian (web)', platform: 'browser' }
  }
  return await invoke('get_app_info')
}

export const tauriAvailable = isTauri