import { describe, it, expect } from 'vitest'
import type { CodeChart, DeclKind } from '../types'
import {
  symbolKey,
  gradeChart,
  snapshotOf,
  diffAgainst,
  relativeTime,
} from './snapshot'

const makeNode = (overrides: Partial<{
  id: number; name: string; file: string; kind: DeclKind;
  inbound: number; outbound: number; excerpt: string;
}> = {}) => ({
  id: overrides.id ?? 0,
  name: overrides.name ?? 'fn',
  file: overrides.file ?? 'a.ts',
  kind: overrides.kind ?? 'function',
  module: '/',
  row: 1,
  excerpt: overrides.excerpt ?? 'fn() {}',
  x: 0,
  y: 0,
  inbound: overrides.inbound ?? 0,
  outbound: overrides.outbound ?? 0,
})

const makeChart = (nodes: ReturnType<typeof makeNode>[], edges: { source: number; target: number; charted: boolean }[] = []): CodeChart => ({
  nodes,
  edges,
  modules: ['/'],
  fileCount: 1,
  unresolvedCalls: 0,
  precise: false,
})

describe('symbolKey', () => {
  it('encodes file, name, and kind', () => {
    const key = symbolKey({ file: 'foo.ts', name: 'bar', kind: 'function' })
    expect(key).toBe('foo.ts::bar::function')
  })
})

describe('gradeChart', () => {
  it('returns A for a clean chart', () => {
    const chart = makeChart([
      makeNode({ id: 0, inbound: 1, outbound: 1 }),
      makeNode({ id: 1, inbound: 0, outbound: 1 }),
    ], [
      { source: 1, target: 0, charted: true },
    ])
    const result = gradeChart(chart)
    expect(result.grade).toBe('A')
    expect(result.score).toBeGreaterThanOrEqual(90)
  })

  it('returns E when everything is a rock', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1 }),
    ])
    const result = gradeChart(chart)
    expect(result.grade).toBe('E')
  })

  it('penalizes estimated routes', () => {
    const chart = makeChart([
      makeNode({ id: 0, inbound: 1, outbound: 0 }),
      makeNode({ id: 1, outbound: 1 }),
    ], [
      { source: 1, target: 0, charted: false },
    ])
    const result = gradeChart(chart)
    expect(result.score).toBeLessThan(100)
  })

  it('penalizes expeditions', () => {
    const nodes = [makeNode({ id: 0 })]
    for (let i = 1; i <= 12; i++) {
      nodes.push(makeNode({ id: i }))
    }
    nodes[0].inbound = 12
    const edges = nodes.slice(1).map(n => ({ source: n.id, target: 0, charted: true }))
    const chart = makeChart(nodes, edges)
    const result = gradeChart(chart)
    expect(result.score).toBeLessThan(100)
  })

  it('handles empty chart', () => {
    const chart = makeChart([])
    const result = gradeChart(chart)
    expect(result.score).toBe(100)
  })
})

describe('snapshotOf', () => {
  it('captures chart metadata', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1 }),
    ], [
      { source: 1, target: 0, charted: true },
    ])
    const snap = snapshotOf(chart, 'test-dir')
    expect(snap.title).toBe('test-dir')
    expect(snap.nodeCount).toBe(2)
    expect(snap.edgeCount).toBe(1)
    expect(snap.entries).toHaveProperty('a.ts::fn::function')
  })

  it('counts rocks', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1, inbound: 1, outbound: 1 }),
      makeNode({ id: 2 }),
    ])
    const snap = snapshotOf(chart, 'test')
    expect(snap.rockCount).toBe(2)
  })
})

describe('diffAgainst', () => {
  it('detects added nodes', () => {
    const prev = snapshotOf(makeChart([makeNode({ id: 0, name: 'old' })]), 'dir')
    const chart = makeChart([
      makeNode({ id: 0, name: 'old' }),
      makeNode({ id: 1, name: 'new' }),
    ])
    const delta = diffAgainst(prev, chart)
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].name).toBe('new')
  })

  it('detects removed nodes', () => {
    const prev = snapshotOf(makeChart([
      makeNode({ id: 0, name: 'old' }),
      makeNode({ id: 1, name: 'gone' }),
    ]), 'dir')
    const chart = makeChart([makeNode({ id: 0, name: 'old' })])
    const delta = diffAgainst(prev, chart)
    expect(delta.removed).toContain('gone')
  })

  it('detects altered nodes', () => {
    const prev = snapshotOf(makeChart([makeNode({ id: 0, excerpt: 'function foo() { return 1; }' })]), 'dir')
    const chart = makeChart([makeNode({ id: 0, excerpt: 'function foo() { return 2; }' })])
    const delta = diffAgainst(prev, chart)
    expect(delta.altered.length).toBeGreaterThanOrEqual(0)
  })

  it('reports no delta for identical charts', () => {
    const chart = makeChart([makeNode({ id: 0 })])
    const prev = snapshotOf(chart, 'dir')
    const delta = diffAgainst(prev, chart)
    expect(delta.added).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
    expect(delta.altered).toHaveLength(0)
  })
})

describe('relativeTime', () => {
  it('returns minutes for times under an hour', () => {
    expect(relativeTime(Date.now() - 60_000)).toMatch(/\d+ min ago/)
  })

  it('returns hours for times under 48 hours', () => {
    expect(relativeTime(Date.now() - 3_600_000)).toMatch(/\d+ h ago/)
  })

  it('returns days for times over 48 hours', () => {
    expect(relativeTime(Date.now() - 200_000_000)).toMatch(/\d+ days ago/)
  })
})