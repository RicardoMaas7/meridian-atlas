import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToasts, pushToast } from './useToasts'

describe('useToasts hook', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts with an empty list', () => {
    const { result } = renderHook(() => useToasts())
    expect(result.current.toasts).toEqual([])
  })

  it('appends pushed toasts', () => {
    const { result } = renderHook(() => useToasts())
    act(() => pushToast({ kind: 'info', message: 'hi' }))
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('hi')
  })

  it('dismisses manually', () => {
    const { result } = renderHook(() => useToasts())
    act(() => pushToast({ kind: 'success', message: 'a', ttlMs: 0 }))
    const id = result.current.toasts[0].id
    act(() => result.current.dismiss(id))
    expect(result.current.toasts).toEqual([])
  })

  it('auto-dismisses after the TTL expires', () => {
    const { result } = renderHook(() => useToasts())
    act(() => pushToast({ kind: 'info', message: 'bye', ttlMs: 1000 }))
    expect(result.current.toasts).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(1100) })
    expect(result.current.toasts).toEqual([])
  })
})
