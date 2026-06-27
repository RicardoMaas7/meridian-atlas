// Single source of truth for the chart's complexity thresholds. These
// numbers power both the chart visualization (ChartCanvas paints the
// kinds based on inbound/outbound counts) and the side panel
// recommendations, so they MUST live in one place.

export const LIGHTHOUSE_MIN_INBOUND = 5
export const PORT_MIN_OUTBOUND = 3
export const EXPEDITION_MIN_OUTBOUND = 8
export const HUB_MIN_OUTBOUND = 15

export type ComplexityBand = 'low' | 'mid' | 'high' | 'extreme'

export interface Complexity {
  band: ComplexityBand
  label: string
  threshold: number
}

export function complexityBand(outbound: number): Complexity {
  if (outbound >= HUB_MIN_OUTBOUND) return { band: 'extreme', label: 'extreme', threshold: HUB_MIN_OUTBOUND }
  if (outbound >= EXPEDITION_MIN_OUTBOUND) return { band: 'high', label: 'high', threshold: EXPEDITION_MIN_OUTBOUND }
  if (outbound >= PORT_MIN_OUTBOUND) return { band: 'mid', label: 'mid', threshold: PORT_MIN_OUTBOUND }
  return { band: 'low', label: 'low', threshold: 0 }
}

export function isRock(node: { inbound: number; outbound: number }): boolean {
  return node.inbound === 0 && node.outbound === 0
}

export function isLighthouse(node: { inbound: number }): boolean {
  return node.inbound >= LIGHTHOUSE_MIN_INBOUND
}

export function isPort(node: { inbound: number; outbound: number }): boolean {
  return node.inbound === 0 && node.outbound >= PORT_MIN_OUTBOUND
}

export function isExpedition(node: { outbound: number }): boolean {
  return node.outbound >= EXPEDITION_MIN_OUTBOUND
}
