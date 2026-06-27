import { useCallback, useEffect, useState } from 'react'

export type ToastKind = 'info' | 'success' | 'warn' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  detail?: string
  /** Optional sticky timeout override; defaults to 3.5s. */
  ttlMs?: number
}

const listeners = new Set<(t: Toast) => void>()
let counter = 0

/**
 * Imperative toast API: call from anywhere (event handlers, async
 * code) without threading props through React. Subscribers receive
 * the toast and decide how to render it.
 */
export function pushToast(input: Omit<Toast, 'id'>): void {
  const toast: Toast = { id: ++counter, ...input }
  for (const l of listeners) l(toast)
}

export function subscribeToasts(fn: (t: Toast) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useToasts(): { toasts: Toast[]; dismiss: (id: number) => void; push: typeof pushToast } {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsub = subscribeToasts((t) => {
      setToasts((prev) => [...prev, t])
      const ttl = t.ttlMs ?? 3500
      if (ttl > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id))
        }, ttl)
      }
    })
    return unsub
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, dismiss, push: pushToast }
}
