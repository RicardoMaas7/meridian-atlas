import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecents } from './useRecents'

describe('useRecents', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty when storage is empty', () => {
    const { result } = renderHook(() => useRecents())
    expect(result.current.recents).toEqual([])
  })

  it('adds a recent at the top', () => {
    const { result } = renderHook(() => useRecents())
    act(() => result.current.addRecent({ name: 'proj', path: '/tmp/proj' }))
    expect(result.current.recents).toHaveLength(1)
    expect(result.current.recents[0].path).toBe('/tmp/proj')
    expect(typeof result.current.recents[0].openedAt).toBe('number')
  })

  it('deduplicates by path, bumping the duplicate to the top', async () => {
    const { result } = renderHook(() => useRecents())
    act(() => result.current.addRecent({ name: 'a', path: '/p/a' }))
    act(() => result.current.addRecent({ name: 'b', path: '/p/b' }))
    act(() => result.current.addRecent({ name: 'a again', path: '/p/a' }))
    expect(result.current.recents).toHaveLength(2)
    expect(result.current.recents[0].path).toBe('/p/a')
    expect(result.current.recents[0].name).toBe('a again')
    expect(result.current.recents[1].path).toBe('/p/b')
  })

  it('removes by path', () => {
    const { result } = renderHook(() => useRecents())
    act(() => result.current.addRecent({ name: 'a', path: '/p/a' }))
    act(() => result.current.addRecent({ name: 'b', path: '/p/b' }))
    act(() => result.current.removeRecent('/p/a'))
    expect(result.current.recents.map((r) => r.path)).toEqual(['/p/b'])
  })

  it('clears all', () => {
    const { result } = renderHook(() => useRecents())
    act(() => result.current.addRecent({ name: 'a', path: '/p/a' }))
    act(() => result.current.clearRecents())
    expect(result.current.recents).toEqual([])
  })

  it('persists across hook remounts', () => {
    const first = renderHook(() => useRecents())
    act(() => first.result.current.addRecent({ name: 'a', path: '/p/a' }))
    first.unmount()
    const second = renderHook(() => useRecents())
    expect(second.result.current.recents).toHaveLength(1)
    expect(second.result.current.recents[0].path).toBe('/p/a')
  })

  it('caps the list at the maximum size', () => {
    const { result } = renderHook(() => useRecents())
    for (let i = 0; i < 12; i++) {
      act(() => result.current.addRecent({ name: `p${i}`, path: `/p/${i}` }))
    }
    expect(result.current.recents.length).toBeLessThanOrEqual(6)
  })

  it('ignores garbage in storage', () => {
    localStorage.setItem('meridian:recents', 'not json')
    const { result } = renderHook(() => useRecents())
    expect(result.current.recents).toEqual([])
  })
})
