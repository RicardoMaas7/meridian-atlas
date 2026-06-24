import { describe, it, expect } from 'vitest'
import type { CodeChart, DeclKind } from '../types'
import { interpretChart, interpretNode } from './interpret'

const makeNode = (overrides: Partial<{
  id: number; name: string; file: string; kind: DeclKind;
  inbound: number; outbound: number; module: string;
}> = {}) => ({
  id: overrides.id ?? 0,
  name: overrides.name ?? 'fn',
  file: overrides.file ?? 'a.ts',
  kind: overrides.kind ?? 'function',
  module: overrides.module ?? '/',
  row: 1,
  excerpt: 'fn() {}',
  x: 0,
  y: 0,
  inbound: overrides.inbound ?? 0,
  outbound: overrides.outbound ?? 0,
})

const makeChart = (
  nodes: ReturnType<typeof makeNode>[],
  edges: { source: number; target: number; charted: boolean }[] = [],
  modules: string[] = ['/'],
): CodeChart => ({
  nodes,
  edges,
  modules,
  fileCount: 1,
  unresolvedCalls: 0,
  precise: false,
})

describe('interpretChart', () => {
  it('returns empty array for empty chart', () => {
    const chart = makeChart([])
    expect(interpretChart(chart)).toHaveLength(0)
  })

  it('detects islands', () => {
    const chart = makeChart([
      makeNode({ id: 0, file: 'a.ts' }),
      makeNode({ id: 1, file: 'a.ts' }),
      makeNode({ id: 2, file: 'b.ts' }),
      makeNode({ id: 3, file: 'b.ts' }),
    ], [
      { source: 0, target: 1, charted: true },
      { source: 2, target: 3, charted: true },
    ])
    const observations = interpretChart(chart)
    const island = observations.find(o => o.title.includes('islands'))
    expect(island).toBeDefined()
    expect(island?.title).toContain('2 islands')
  })

  it('detects lighthouses', () => {
    const chart = makeChart([
      makeNode({ id: 0, inbound: 5 }),
      makeNode({ id: 1 }),
      makeNode({ id: 2, outbound: 1 }),
    ], [
      { source: 2, target: 0, charted: true },
    ])
    const observations = interpretChart(chart)
    const lighthouse = observations.find(o => o.title === 'Lighthouses')
    expect(lighthouse).toBeDefined()
    expect(lighthouse?.refs).toHaveLength(1)
  })

  it('detects ports of departure', () => {
    const chart = makeChart([
      makeNode({ id: 0, outbound: 5 }),
      makeNode({ id: 1 }),
    ], [
      { source: 0, target: 1, charted: true },
    ])
    const observations = interpretChart(chart)
    const ports = observations.find(o => o.title === 'Ports of departure')
    expect(ports).toBeDefined()
    expect(ports?.refs?.[0].name).toContain('→5')
  })

  it('detects rocks', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1 }),
    ])
    const observations = interpretChart(chart)
    const rocks = observations.find(o => o.title.includes('rock'))
    expect(rocks).toBeDefined()
    expect(rocks?.title).toContain('2 rocks')
  })

  it('flags estimated waters at 25% or more', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1 }),
      makeNode({ id: 2 }),
    ], [
      { source: 1, target: 0, charted: false },
      { source: 2, target: 0, charted: false },
      { source: 1, target: 2, charted: true },
    ])
    const observations = interpretChart(chart)
    const estimated = observations.find(o => o.title.includes('% estimated'))
    expect(estimated).toBeDefined()
    expect(estimated?.title).toContain('67%')
  })

  it('detects straits (cross-module coupling)', () => {
    const chart: CodeChart = {
      nodes: [
        { id: 0, name: 'fn', file: 'a.ts', kind: 'function', module: 'src/a', row: 1, excerpt: 'fn() {}', x: 0, y: 0, inbound: 0, outbound: 1 },
        { id: 1, name: 'fn', file: 'b.ts', kind: 'function', module: 'src/b', row: 1, excerpt: 'fn() {}', x: 0, y: 0, inbound: 1, outbound: 0 },
      ],
      edges: [
        { source: 0, target: 1, charted: true },
      ],
      modules: ['src/a', 'src/b'],
      fileCount: 2,
      unresolvedCalls: 0,
      precise: false,
    }
    const observations = interpretChart(chart)
    const straits = observations.find(o => o.title === 'Straits')
    expect(straits).toBeDefined()
    expect(straits?.body).toContain('1 route')
  })

  it('reports clean separation when modules do not cross', () => {
    const chart = makeChart([
      makeNode({ id: 0 }),
      makeNode({ id: 1 }),
    ], [], ['a', 'b'])
    const observations = interpretChart(chart)
    const clean = observations.find(o => o.title === 'Clean separation')
    expect(clean).toBeDefined()
  })

  it('detects dead exports (public surface nobody uses)', () => {
    const chart = makeChart([
      makeNode({ id: 0, name: 'helper', outbound: 3 }),
      makeNode({ id: 1, name: 'unused', outbound: 5 }),
      makeNode({ id: 2, name: 'caller', inbound: 1, outbound: 2 }),
    ], [
      { source: 0, target: 2, charted: true },
      { source: 2, target: 1, charted: true },
    ], ['lib'])
    const observations = interpretChart(chart)
    const dead = observations.find(o => o.title.includes('dead export'))
    expect(dead).toBeDefined()
  })

  it('detects cascade risk when a hub fans out into many called-by-many symbols', () => {
    // core (id 0) calls into 4 lighthouses (each called by 4+ other
    // symbols). The blast radius is the sum of those inbounds = 4*4
    // = 16, well above the 8 threshold.
    const chart = makeChart([
      makeNode({ id: 0, name: 'core', file: 'a.ts', module: 'core', outbound: 4 }),
      makeNode({ id: 1, name: 'svc1', file: 'b.ts', module: 'svc', inbound: 4 }),
      makeNode({ id: 2, name: 'svc2', file: 'c.ts', module: 'svc', inbound: 4 }),
      makeNode({ id: 3, name: 'svc3', file: 'd.ts', module: 'svc', inbound: 4 }),
      makeNode({ id: 4, name: 'svc4', file: 'e.ts', module: 'svc', inbound: 4 }),
    ], [
      { source: 0, target: 1, charted: true },
      { source: 0, target: 2, charted: true },
      { source: 0, target: 3, charted: true },
      { source: 0, target: 4, charted: true },
    ], ['core', 'svc'])
    const observations = interpretChart(chart)
    const cascade = observations.find(o => o.title === 'Cascade risk')
    expect(cascade).toBeDefined()
  })

  it('detects tangled modules with high internal density', () => {
    const nodes = []
    for (let i = 0; i < 8; i++) {
      nodes.push(makeNode({ id: i, name: `n${i}`, file: `mod/f${i}.ts`, module: 'mod' }))
    }
    const edges = []
    // Almost fully connected inside the module
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i !== j) edges.push({ source: i, target: j, charted: true })
      }
    }
    const chart = makeChart(nodes, edges, ['mod'])
    chart.fileCount = 8
    const observations = interpretChart(chart)
    const tangled = observations.find(o => o.title === 'Tangled module')
    expect(tangled).toBeDefined()
  })
})

describe('interpretNode', () => {
  it('returns null for unremarkable nodes', () => {
    const chart = makeChart([makeNode({ id: 0, inbound: 1, outbound: 1 })])
    expect(interpretNode(chart, chart.nodes[0])).toBeNull()
  })

  it('identifies lighthouses', () => {
    const chart = makeChart([makeNode({ id: 0, inbound: 5 })])
    expect(interpretNode(chart, chart.nodes[0])).toContain('lighthouse')
  })

  it('identifies ports of departure', () => {
    const chart = makeChart([makeNode({ id: 0, outbound: 5 })])
    expect(interpretNode(chart, chart.nodes[0])).toContain('port of departure')
  })

  it('identifies rocks', () => {
    const chart = makeChart([makeNode({ id: 0 })])
    expect(interpretNode(chart, chart.nodes[0])).toContain('rock')
  })

  it('identifies expeditions', () => {
    const chart = makeChart([makeNode({ id: 0, outbound: 10, inbound: 1 })])
    expect(interpretNode(chart, chart.nodes[0])).toContain('expedition')
  })

  it('describes instantiated classes', () => {
    const chart = makeChart([makeNode({ id: 0, kind: 'class', inbound: 2 })])
    expect(interpretNode(chart, chart.nodes[0])).toContain('Instantiated')
  })
})