import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'

export type MenuAction =
  | 'open_folder'
  | 'view_specimen'
  | 'new_chart'
  | 'resurvey'
  | 'about'
  | 'export_chart'
  | 'import_chart'

export interface MenuHandlers {
  onOpenFolder: () => void
  onViewSpecimen: () => void
  onNewChart: () => void
  onResurvey: () => void
  onAbout: () => void
  onExportChart: () => void
  onImportChart: () => void
}

/**
 * Subscribes to native menu events emitted by the Tauri backend.
 * Silently does nothing on the web (where `listen` either fails or
 * yields no events).
 */
export function useNativeMenu(enabled: boolean, handlers: MenuHandlers): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return
    let unlisten: (() => void) | undefined
    listen<string>('menu', (event) => {
      const a = event.payload as MenuAction
      const h = handlersRef.current
      switch (a) {
        case 'open_folder': h.onOpenFolder(); break
        case 'view_specimen': h.onViewSpecimen(); break
        case 'new_chart': h.onNewChart(); break
        case 'resurvey': h.onResurvey(); break
        case 'about': h.onAbout(); break
        case 'export_chart': h.onExportChart(); break
        case 'import_chart': h.onImportChart(); break
      }
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [enabled])
}
