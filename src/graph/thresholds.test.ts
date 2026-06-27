import { describe, it, expect } from 'vitest'
import {
  complexityBand,
  isExpedition,
  isLighthouse,
  isPort,
  isRock,
  HUB_MIN_OUTBOUND,
  EXPEDITION_MIN_OUTBOUND,
  PORT_MIN_OUTBOUND,
  LIGHTHOUSE_MIN_INBOUND,
} from './thresholds'

describe('isRock', () => {
  it('flags a node with no edges as a rock', () => {
    expect(isRock({ inbound: 0, outbound: 0 })).toBe(true)
  })
  it('does not flag a node with any edge as a rock', () => {
    expect(isRock({ inbound: 1, outbound: 0 })).toBe(false)
    expect(isRock({ inbound: 0, outbound: 1 })).toBe(false)
  })
})

describe('isLighthouse', () => {
  it('flags highly-called nodes', () => {
    expect(isLighthouse({ inbound: LIGHTHOUSE_MIN_INBOUND })).toBe(true)
    expect(isLighthouse({ inbound: LIGHTHOUSE_MIN_INBOUND + 10 })).toBe(true)
  })
  it('does not flag lightly-called nodes', () => {
    expect(isLighthouse({ inbound: LIGHTHOUSE_MIN_INBOUND - 1 })).toBe(false)
    expect(isLighthouse({ inbound: 0 })).toBe(false)
  })
})

describe('isPort', () => {
  it('flags a node with no callers but several callees', () => {
    expect(isPort({ inbound: 0, outbound: PORT_MIN_OUTBOUND })).toBe(true)
  })
  it('does not flag if any caller exists or too few callees', () => {
    expect(isPort({ inbound: 1, outbound: PORT_MIN_OUTBOUND })).toBe(false)
    expect(isPort({ inbound: 0, outbound: PORT_MIN_OUTBOUND - 1 })).toBe(false)
  })
})

describe('isExpedition', () => {
  it('flags wide-fanout symbols', () => {
    expect(isExpedition({ outbound: EXPEDITION_MIN_OUTBOUND })).toBe(true)
    expect(isExpedition({ outbound: 100 })).toBe(true)
  })
  it('does not flag narrow symbols', () => {
    expect(isExpedition({ outbound: EXPEDITION_MIN_OUTBOUND - 1 })).toBe(false)
  })
})

describe('complexityBand', () => {
  it('returns low for small fanout', () => {
    expect(complexityBand(0).band).toBe('low')
    expect(complexityBand(PORT_MIN_OUTBOUND - 1).band).toBe('low')
  })
  it('returns mid for moderate fanout', () => {
    expect(complexityBand(PORT_MIN_OUTBOUND).band).toBe('mid')
  })
  it('returns high at the expedition threshold', () => {
    expect(complexityBand(EXPEDITION_MIN_OUTBOUND).band).toBe('high')
  })
  it('returns extreme at the hub threshold', () => {
    expect(complexityBand(HUB_MIN_OUTBOUND).band).toBe('extreme')
    expect(complexityBand(HUB_MIN_OUTBOUND + 50).band).toBe('extreme')
  })
  it('records the threshold that triggered the band', () => {
    expect(complexityBand(HUB_MIN_OUTBOUND).threshold).toBe(HUB_MIN_OUTBOUND)
    expect(complexityBand(EXPEDITION_MIN_OUTBOUND).threshold).toBe(EXPEDITION_MIN_OUTBOUND)
    expect(complexityBand(2).threshold).toBe(0)
  })
})
