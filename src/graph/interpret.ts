import type { ChartNode, ChartEdge, CodeChart } from '../types'

/**
 * Remarks: the numbered marginal notes printed on a chart. Written like a
 * surveyor wrote them — short, declarative, no hedging.
 */
export interface Observation {
  title: string
  body: string
  /** symbols the observation refers to; rendered as clickable names */
  refs?: { id: number; name: string }[]
}

function findWithPathCompression(parent: Map<number, number>, a: number): number {
  let root = a
  while (parent.get(root) !== root) root = parent.get(root)!
  let cur = a
  while (parent.get(cur) !== cur) {
    const next = parent.get(cur)!
    parent.set(cur, root)
    cur = next
  }
  return root
}

function unionNodes(parent: Map<number, number>, a: number, b: number): void {
  const ra = findWithPathCompression(parent, a)
  const rb = findWithPathCompression(parent, b)
  if (ra !== rb) parent.set(ra, rb)
}

/** Detect God modules: a module with many internal connections that
 *  is a tangled ball rather than a layered system. */
function detectGodModules(nodes: ChartNode[], edges: ChartEdge[]): Array<{ name: string; score: number }> {
  const moduleNodes = new Map<string, ChartNode[]>()
  for (const n of nodes) {
    const list = moduleNodes.get(n.module) ?? []
    list.push(n)
    moduleNodes.set(n.module, list)
  }
  const moduleEdgeCount = new Map<string, number>()
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source)
    const b = nodes.find((n) => n.id === e.target)
    if (!a || !b || a.module !== b.module) continue
    moduleEdgeCount.set(a.module, (moduleEdgeCount.get(a.module) ?? 0) + 1)
  }
  const results: Array<{ name: string; score: number }> = []
  for (const [m, list] of moduleNodes) {
    const n = list.length
    if (n < 8) continue
    const e = moduleEdgeCount.get(m) ?? 0
    const max = n * (n - 1)
    if (max === 0) continue
    const density = e / max
    if (density > 0.3) {
      results.push({ name: m, score: density })
    }
  }
  return results.sort((a, b) => b.score - a.score)
}

/** Detect dead exports: symbols defined but never called, in modules
 *  that have at least one called symbol. Likely public surface that
 *  nobody uses — or used from outside the survey. */
function detectDeadExports(nodes: ChartNode[]): ChartNode[] {
  const moduleHasCalls = new Map<string, boolean>()
  for (const n of nodes) {
    if (n.inbound > 0) moduleHasCalls.set(n.module, true)
  }
  return nodes
    .filter((n) =>
      n.inbound === 0 &&
      n.outbound > 0 &&
      (moduleHasCalls.get(n.module) ?? false),
    )
    .sort((a, b) => b.outbound - a.outbound)
    .slice(0, 3)
}

/** Find cascade risk: a symbol that, when changed, propagates widely
 *  through its outbound call tree (weighted by the inbound traffic
 *  of each reachable node). */
function detectCascadeRisk(nodes: ChartNode[], edges: ChartEdge[]): Array<{ name: string; blastRadius: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const cascadeNodes: Array<{ name: string; blastRadius: number }> = []
  for (const n of nodes) {
    if (n.outbound < 1) continue
    const seen = new Set<number>([n.id])
    let frontier: number[] = []
    for (const e of edges) {
      if (e.source === n.id && !seen.has(e.target)) {
        seen.add(e.target)
        frontier.push(e.target)
      }
    }
    let depth = 0
    while (frontier.length > 0 && depth < 4) {
      const next: number[] = []
      for (const id of frontier) {
        for (const e of edges) {
          if (e.source === id && !seen.has(e.target)) {
            seen.add(e.target)
            next.push(e.target)
          }
        }
      }
      frontier = next
      depth++
    }
    const reachable = seen.size - 1
    // Weight by each reachable node's inbound, so a leaf that is
    // itself a lighthouse counts for more than a leaf nobody calls.
    let weight = 0
    for (const id of seen) {
      if (id === n.id) continue
      const target = byId.get(id)
      if (target) weight += Math.max(1, target.inbound)
    }
    if (reachable >= 3 && weight >= 8) {
      cascadeNodes.push({ name: n.name, blastRadius: weight })
    }
  }
  return cascadeNodes.sort((a, b) => b.blastRadius - a.blastRadius).slice(0, 3)
}

export function interpretChart(chart: CodeChart): Observation[] {
  const observations: Observation[] = []
  const { nodes, edges } = chart
  if (nodes.length === 0) return observations

  // --- connected components (islands) ---
  const parent = new Map<number, number>()
  for (const n of nodes) parent.set(n.id, n.id)
  for (const e of edges) unionNodes(parent, e.source, e.target)

  const components = new Map<number, ChartNode[]>()
  for (const n of nodes) {
    const root = findWithPathCompression(parent, n.id)
    const list = components.get(root) ?? []
    list.push(n)
    components.set(root, list)
  }
  const islands = [...components.values()]
    .filter((c) => c.length >= 2)
    .sort((a, b) => b.length - a.length)

  if (islands.length > 1) {
    const described = islands.slice(0, 4).map((island) => {
      const counts = new Map<string, number>()
      for (const n of island) counts.set(n.file, (counts.get(n.file) ?? 0) + 1)
      const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return `${island.length} around ${main}`
    })
    observations.push({
      title: `${islands.length} islands`,
      body:
        `No calls join these groups: ${described.join('; ')}` +
        (islands.length > 4 ? '; others smaller' : '') +
        '. If they are connected, it is by means this survey cannot see.',
    })
  }

  // --- lighthouses ---
  const lighthouses = [...nodes]
    .sort((a, b) => b.inbound - a.inbound)
    .slice(0, 3)
    .filter((n) => n.inbound >= 3)
  if (lighthouses.length > 0) {
    observations.push({
      title: 'Lighthouses',
      body: 'The most-called symbols. A change here reaches the whole chart.',
      refs: lighthouses.map((n) => ({ id: n.id, name: `${n.name} (${n.inbound})` })),
    })
  }

  // --- ports of departure ---
  const ports = nodes
    .filter((n) => n.inbound === 0 && n.outbound >= 3)
    .sort((a, b) => b.outbound - a.outbound)
    .slice(0, 3)
  if (ports.length > 0) {
    observations.push({
      title: 'Ports of departure',
      body: 'Called by nothing surveyed, yet many routes set out from them. The likely entry points.',
      refs: ports.map((n) => ({ id: n.id, name: `${n.name} (→${n.outbound})` })),
    })
  }

  // --- uncharted rocks ---
  const rocks = nodes.filter((n) => n.inbound === 0 && n.outbound === 0)
  if (rocks.length > 0) {
    observations.push({
      title: `${rocks.length} rock${rocks.length === 1 ? '' : 's'}`,
      body: 'No route touches them. Dead code, or called from outside the survey: tests, templates, reflection.',
      refs: rocks.slice(0, 5).map((n) => ({ id: n.id, name: n.name })),
    })
  }

  // --- dead exports: public surface nobody uses ---
  const deadExports = detectDeadExports(nodes)
  if (deadExports.length > 0) {
    observations.push({
      title: `${deadExports.length} dead export${deadExports.length === 1 ? '' : 's'}`,
      body: 'Symbols defined in modules with active code, but called by nothing in the survey. Possibly public surface nobody uses — or used from outside (tests, plugins).',
      refs: deadExports.map((n) => ({ id: n.id, name: `${n.name} (${n.outbound} out)` })),
    })
  }

  // --- cascade risk ---
  const cascade = detectCascadeRisk(nodes, edges)
  if (cascade.length > 0) {
    observations.push({
      title: 'Cascade risk',
      body: `Changes to these symbols would propagate to ${cascade[0].blastRadius}+ call sites through their dependents.`,
      refs: cascade.map((c) => ({ id: 0, name: `${c.name} (→${c.blastRadius})` })),
    })
  }

  // --- god modules ---
  const godModules = detectGodModules(nodes, edges)
  if (godModules.length > 0) {
    observations.push({
      title: 'Tangled module',
      body: `Module "${godModules[0].name}" has high internal coupling. Its symbols form a dense graph rather than a layered system — refactor candidate.`,
    })
  }

  // --- estimated waters ---
  const estimated = edges.filter((e) => !e.charted).length
  if (edges.length > 0) {
    const pct = Math.round((estimated / edges.length) * 100)
    if (pct >= 25) {
      observations.push({
        title: `${pct}% estimated`,
        body: 'That share of routes is matched by name alone; short common names collide. Dashed routes are leads, not facts.',
      })
    }
  }

  // --- straits ---
  if (chart.modules.length > 1) {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const pairCounts = new Map<string, number>()
    let crossing = 0
    for (const e of edges) {
      const a = byId.get(e.source)
      const b = byId.get(e.target)
      if (!a || !b || a.module === b.module) continue
      crossing++
      const key = [a.module, b.module].sort().join(' ⇄ ')
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }
    if (crossing > 0) {
      const busiest = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      observations.push({
        title: 'Straits',
        body: `${crossing} route${crossing === 1 ? '' : 's'} cross module boundaries. Busiest: ${busiest[0]} (${busiest[1]}). That is where the modules are entangled.`,
      })
    } else {
      observations.push({
        title: 'Clean separation',
        body: 'No route crosses a module boundary.',
      })
    }
  }

  return observations
}

/** One-line reading of a single symbol, shown when it is selected. */
export function interpretNode(chart: CodeChart, node: ChartNode): string | null {
  const files = new Set(
    chart.edges
      .filter((e) => e.target === node.id)
      .map((e) => chart.nodes.find((n) => n.id === e.source)?.file)
      .filter(Boolean),
  )

  if (node.inbound >= 5) {
    return `A lighthouse. ${node.inbound} routes arrive from ${files.size} file${files.size === 1 ? '' : 's'}; changes here travel far.`
  }
  if (node.inbound === 0 && node.outbound >= 3) {
    return 'A port of departure. Nothing surveyed calls it: an entry point, handler, or exported API.'
  }
  if (node.inbound === 0 && node.outbound === 0) {
    return 'A rock. No route touches it: dead code, or called from outside the survey.'
  }
  if (node.outbound >= 8) {
    return `An expedition. ${node.outbound} routes set out from here; complexity gathers in symbols like this.`
  }
  if (node.kind === 'class' && node.inbound >= 1) {
    return `Instantiated or referenced ${node.inbound} time${node.inbound === 1 ? '' : 's'} on the chart.`
  }
  return null
}
