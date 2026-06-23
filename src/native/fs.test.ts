import { describe, it, expect } from 'vitest'
import { tauriAvailable } from './fs'

describe('fs', () => {
  it('reports tauri availability correctly', () => {
    const available = tauriAvailable()
    expect(typeof available).toBe('boolean')
  })
})