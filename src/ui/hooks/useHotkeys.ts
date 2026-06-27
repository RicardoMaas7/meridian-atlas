import { useEffect } from 'react'
import type { SurveyPhase } from './useSurvey'

export interface HotkeyHandlers {
  onSearch: () => void
  onCycleFilter: () => void
  onToggleRocks: () => void
  onToggleNewOnly: () => void
  onToggleHelp: () => void
  onEscape: () => void
}

/**
 * Global hotkeys for the charted phase. Inputs are exempt so typing in
 * the search box does not cycle filters.
 */
export function useHotkeys(
  phaseRef: React.MutableRefObject<SurveyPhase>,
  selectedId: number | null,
  setSelectedId: (id: number | null) => void,
  showSearch: boolean,
  setShowSearch: (v: boolean) => void,
  showHelp: boolean,
  setShowHelp: (v: boolean) => void,
  h: HotkeyHandlers,
) {
  useEffect(() => {
    if (phaseRef.current.name !== 'charted') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        h.onSearch()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        h.onCycleFilter()
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        h.onToggleRocks()
      } else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        h.onToggleNewOnly()
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        h.onToggleHelp()
      } else if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false)
        else if (selectedId) setSelectedId(null)
        else if (showHelp) setShowHelp(false)
        h.onEscape()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phaseRef, selectedId, setSelectedId, showSearch, setShowSearch, showHelp, setShowHelp, h])
}
