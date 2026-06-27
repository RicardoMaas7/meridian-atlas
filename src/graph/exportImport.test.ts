import { describe, it, expect } from 'vitest'
import { buildExportPayload, importChartPayload, EXPORT_SCHEMA } from './exportImport'
import type { CodeChart } from '../types'

function makeChart(): CodeChart {
  return {
    nodes: [
      { id: 1, name: 'alpha', kind: 'function', file: 'a.ts', module: 'a', row: 1, excerpt: 'function alpha() {}', inbound: 2, outbound: 1, x: 0, y: 0 },
      { id: 2, name: 'beta', kind: 'method', file: 'b.ts', module: 'b', row: 5, excerpt: 'beta() { alpha() }', inbound: 0, outbound: 1, x: 0, y: 0 },
    ],
    edges: [{ source: 2, target: 1, charted: true }],
    modules: ['a', 'b'],
    fileCount: 2,
    unresolvedCalls: 0,
    precise: false,
  }
}

describe('buildExportPayload', () => {
  it('tags the payload with the current schema', () => {
    const payload = buildExportPayload(makeChart(), 'demo')
    expect(payload.schema).toBe(EXPORT_SCHEMA)
    expect(payload.title).toBe('demo')
    expect(typeof payload.exportedAt).toBe('string')
  })

  it('copies every node, edge and module', () => {
    const chart = makeChart()
    const payload = buildExportPayload(chart, 'demo')
    expect(payload.nodes).toHaveLength(chart.nodes.length)
    expect(payload.edges).toEqual(chart.edges)
    expect(payload.modules).toEqual(chart.modules)
  })
})

describe('importChartPayload', () => {
  it('round-trips a chart', () => {
    const original = makeChart()
    const payload = buildExportPayload(original, 'demo')
    const restored = importChartPayload(payload)
    expect(restored.nodes).toHaveLength(2)
    expect(restored.edges).toEqual([{ source: 2, target: 1, charted: true }])
    expect(restored.modules).toEqual(['a', 'b'])
    expect(restored.fileCount).toBe(2)
    expect(restored.unresolvedCalls).toBe(0)
  })

  it('rejects an unknown schema', () => {
    expect(() => importChartPayload({ schema: 999 } as never)).toThrow(/schema/)
  })

  it('rejects a non-chart object', () => {
    expect(() => importChartPayload({} as never)).toThrow()
  })
})
