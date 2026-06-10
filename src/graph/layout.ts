import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import type { Simulation } from 'd3-force'
import type { ChartEdge, ChartNode, CodeChart } from '../types'

export interface SimEdge {
  source: ChartNode
  target: ChartNode
  charted: boolean
}

export interface ChartLayout {
  simulation: Simulation<ChartNode, undefined>
  simEdges: SimEdge[]
}

/**
 * Force layout with one extra rule from the chart concept: each module is a "sea",
 * so nodes are gently pulled toward their module's anchor, arranged on a ring.
 */
export function startLayout(chart: CodeChart): ChartLayout {
  const { nodes, edges, modules } = chart

  const anchors = new Map<string, { x: number; y: number }>()
  const ringRadius = Math.max(260, nodes.length * 1.6)
  modules.forEach((m, i) => {
    if (modules.length === 1) {
      anchors.set(m, { x: 0, y: 0 })
      return
    }
    const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2
    anchors.set(m, { x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius })
  })

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const simEdges: SimEdge[] = []
  for (const e of edges as ChartEdge[]) {
    const source = byId.get(e.source)
    const target = byId.get(e.target)
    if (source && target) simEdges.push({ source, target, charted: e.charted })
  }

  // Seed positions near anchors so the simulation settles like a chart being inked in.
  for (const n of nodes) {
    const a = anchors.get(n.module) ?? { x: 0, y: 0 }
    const jitter = 90
    n.x = a.x + (hash(n.id * 2654435761) - 0.5) * jitter
    n.y = a.y + (hash(n.id * 40503 + 7) - 0.5) * jitter
  }

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<ChartNode, SimEdge>(simEdges)
        .id((d) => d.id)
        .distance(70)
        .strength((l) => (l.charted ? 0.35 : 0.08)),
    )
    .force('charge', forceManyBody().strength(-140))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide<ChartNode>((d) => nodeRadius(d) + 6))
    .force('moduleX', forceX<ChartNode>((d) => anchors.get(d.module)?.x ?? 0).strength(0.06))
    .force('moduleY', forceY<ChartNode>((d) => anchors.get(d.module)?.y ?? 0).strength(0.06))
    .alphaDecay(0.035)

  return { simulation, simEdges }
}

export function nodeRadius(node: ChartNode): number {
  return 4 + Math.sqrt(node.inbound) * 2.4
}

/** Deterministic pseudo-random in [0,1) so the same repo always charts the same way. */
function hash(n: number): number {
  let x = n | 0
  x = ((x >> 16) ^ x) * 0x45d9f3b
  x = ((x >> 16) ^ x) * 0x45d9f3b
  x = (x >> 16) ^ x
  return (x >>> 0) / 0xffffffff
}
