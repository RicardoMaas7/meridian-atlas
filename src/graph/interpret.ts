import type { ChartNode, CodeChart } from '../types'

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

export function interpretChart(chart: CodeChart): Observation[] {
  const observations: Observation[] = []
  const { nodes, edges } = chart
  if (nodes.length === 0) return observations

  // --- connected components (islands) ---
  const parent = new Map<number, number>()
  const find = (a: number): number => {
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
  for (const n of nodes) parent.set(n.id, n.id)
  for (const e of edges) parent.set(find(e.source), find(e.target))

  const components = new Map<number, ChartNode[]>()
  for (const n of nodes) {
    const root = find(n.id)
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

  // --- lighthouses: the most depended-upon symbols ---
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

  // --- ports of departure: entry points ---
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

  // --- uncharted rocks: no routes at all ---
  const rocks = nodes.filter((n) => n.inbound === 0 && n.outbound === 0)
  if (rocks.length > 0) {
    observations.push({
      title: `${rocks.length} rock${rocks.length === 1 ? '' : 's'}`,
      body: 'No route touches them. Dead code, or called from outside the survey: tests, templates, reflection.',
      refs: rocks.slice(0, 5).map((n) => ({ id: n.id, name: n.name })),
    })
  }

  // --- estimated waters: how much of the chart is heuristic ---
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

  // --- straits: coupling between modules ---
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
