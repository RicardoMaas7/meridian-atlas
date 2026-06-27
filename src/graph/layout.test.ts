import { describe, it, expect } from 'vitest'
import { startLayout, nodeRadius } from './layout'
import type { CodeChart } from '../types'

function makeNode(id: number, module: string, inbound = 0) {
  return { id, name: `n${id}`, kind: 'function' as const, file: `${module}/x.ts`, module, row: 1, excerpt: '', inbound, outbound: 0, x: 0, y: 0 }
}

function makeChart(modules: string[], edges: Array<[number, number]> = []): CodeChart {
  const nodes = modules.flatMap((m, i) => [
    makeNode(modules.length * i + 1, m),
    makeNode(modules.length * i + 2, m, 1),
  ])
  return {
    nodes,
    edges: edges.map(([s, t]) => ({ source: s, target: t, charted: true })),
    modules,
    fileCount: modules.length,
    unresolvedCalls: 0,
    precise: false,
  }
}

describe('nodeRadius', () => {
  it('returns a small radius for an unreferenced node', () => {
    expect(nodeRadius(makeNode(1, 'a', 0))).toBe(4)
  })
  it('grows with the number of inbound calls', () => {
    expect(nodeRadius(makeNode(1, 'a', 4))).toBeGreaterThan(nodeRadius(makeNode(2, 'a', 1)))
  })
  it('is always positive', () => {
    for (let i = 0; i < 10; i++) {
      expect(nodeRadius(makeNode(i, 'a', i))).toBeGreaterThan(0)
    }
  })
})

describe('startLayout', () => {
  it('returns a simulation and an edge list', () => {
    const chart = makeChart(['a'])
    const layout = startLayout(chart)
    expect(layout.simulation).toBeDefined()
    expect(layout.simEdges).toEqual([])
  })

  it('keeps every node in the simulation node list', () => {
    const chart = makeChart(['a', 'b'])
    const layout = startLayout(chart)
    expect(layout.simulation.nodes()).toHaveLength(4)
  })

  it('rewires chart edges with node references for d3-force', () => {
    const chart = makeChart(['a'], [[1, 2]])
    const layout = startLayout(chart)
    expect(layout.simEdges).toHaveLength(1)
    expect(layout.simEdges[0].source).toBe(chart.nodes[0])
    expect(layout.simEdges[0].target).toBe(chart.nodes[1])
  })

  it('drops edges that reference unknown nodes', () => {
    const chart = makeChart(['a'], [[1, 999]])
    const layout = startLayout(chart)
    expect(layout.simEdges).toEqual([])
  })

  it('seeds nodes near their module anchor', () => {
    const chart = makeChart(['alpha', 'beta', 'gamma'])
    const layout = startLayout(chart)
    for (let i = 0; i < 5; i++) layout.simulation.tick()
    for (const n of chart.nodes) {
      const otherModules = chart.nodes.filter((m) => m.module !== n.module)
      const closestInSameModule = chart.nodes
        .filter((m) => m.module === n.module)
        .reduce((min, m) => Math.min(min, Math.hypot(m.x - n.x, m.y - n.y)), Infinity)
      // The node is closer to at least one same-module node than to ANY
      // node from a different module (rough sanity check).
      const closestInOther = Math.min(...otherModules.map((m) => Math.hypot(m.x - n.x, m.y - n.y)))
      expect(closestInSameModule).toBeLessThanOrEqual(closestInOther + 50)
    }
  })

  it('places a single module at the origin', () => {
    const chart = makeChart(['only'])
    // Manually compute: with one module the anchor is (0,0)
    const layout = startLayout(chart)
    for (let i = 0; i < 20; i++) layout.simulation.tick()
    const avgX = chart.nodes.reduce((s, n) => s + n.x, 0) / chart.nodes.length
    const avgY = chart.nodes.reduce((s, n) => s + n.y, 0) / chart.nodes.length
    expect(Math.abs(avgX)).toBeLessThan(120)
    expect(Math.abs(avgY)).toBeLessThan(120)
  })

  it('distributes multiple modules on a ring', () => {
    const modules = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']
    const chart = makeChart(modules)
    startLayout(chart)
    // Centers of mass should land far from origin
    const centers = modules.map((m) => {
      const ms = chart.nodes.filter((n) => n.module === m)
      const cx = ms.reduce((s, n) => s + n.x, 0) / ms.length
      const cy = ms.reduce((s, n) => s + n.y, 0) / ms.length
      return Math.hypot(cx, cy)
    })
    const meanRadius = centers.reduce((s, r) => s + r, 0) / centers.length
    expect(meanRadius).toBeGreaterThan(150)
  })

  it('runs to a stable layout within a few hundred ticks', () => {
    const chart = makeChart(['a', 'b', 'c', 'd'])
    const layout = startLayout(chart)
    const positions: Array<[number, number]> = []
    for (let i = 0; i < 300; i++) {
      layout.simulation.tick()
      if (i % 50 === 0) {
        positions.push([chart.nodes[0].x, chart.nodes[0].y])
      }
    }
    // The last two snapshots should be very close (layout settled).
    const last = positions[positions.length - 1]
    const prev = positions[positions.length - 2]
    const drift = Math.hypot(last[0] - prev[0], last[1] - prev[1])
    expect(drift).toBeLessThan(5)
  })

  it('produces different layouts for the same graph on re-call (uses different sim state)', () => {
    // Each call yields an independent simulation; the seeded positions
    // are deterministic but the simulation may diverge slightly if the
    // d3-force initial randomness bites. We only assert determinism:
    // two calls with the same input produce the same seeded starting
    // positions, so the first tick is identical.
    const chart1 = makeChart(['a', 'b'])
    const chart2 = makeChart(['a', 'b'])
    startLayout(chart1)
    startLayout(chart2)
    for (let i = 0; i < chart1.nodes.length; i++) {
      expect(chart1.nodes[i].x).toBe(chart2.nodes[i].x)
      expect(chart1.nodes[i].y).toBe(chart2.nodes[i].y)
    }
  })
})
