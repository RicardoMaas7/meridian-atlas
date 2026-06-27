import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pushToast, subscribeToasts } from './useToasts'

describe('toast bus', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('delivers toasts to all subscribers', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = subscribeToasts(a)
    const unsubB = subscribeToasts(b)
    pushToast({ kind: 'info', message: 'hello' })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unsubA()
    unsubB()
  })

  it('stops delivering to unsubscribed listeners', () => {
    const a = vi.fn()
    const unsub = subscribeToasts(a)
    unsub()
    pushToast({ kind: 'info', message: 'hello' })
    expect(a).not.toHaveBeenCalled()
  })

  it('assigns unique ids to each toast', () => {
    const seen: number[] = []
    subscribeToasts((t) => seen.push(t.id))
    pushToast({ kind: 'info', message: 'a' })
    pushToast({ kind: 'info', message: 'b' })
    pushToast({ kind: 'info', message: 'c' })
    expect(new Set(seen).size).toBe(3)
  })
})
