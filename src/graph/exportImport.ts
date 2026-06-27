import type { CodeChart } from '../types'

export interface ExportedChart {
  title: string
  exportedAt: string
  schema: number
  nodes: Array<{
    id: number
    name: string
    kind: string
    file: string
    module: string
    row: number
    excerpt: string
    inbound: number
    outbound: number
  }>
  edges: Array<{ source: number; target: number; charted: boolean }>
  modules: string[]
}

export const EXPORT_SCHEMA = 1

export function buildExportPayload(chart: CodeChart, title: string): ExportedChart {
  return {
    title,
    exportedAt: new Date().toISOString(),
    schema: EXPORT_SCHEMA,
    nodes: chart.nodes.map((n) => ({
      id: n.id, name: n.name, kind: n.kind, file: n.file,
      module: n.module, row: n.row, excerpt: n.excerpt,
      inbound: n.inbound, outbound: n.outbound,
    })),
    edges: chart.edges,
    modules: chart.modules,
  }
}

/**
 * Inflate a chart from a previously exported payload. The payload's
 * inbound/outbound counts are trusted; the rest is verbatim.
 */
export function importChartPayload(payload: ExportedChart): CodeChart {
  if (typeof payload?.schema !== 'number') {
    throw new Error('Not a Meridian chart export')
  }
  if (payload.schema > EXPORT_SCHEMA) {
    throw new Error(`Unsupported schema version ${payload.schema}; this build understands up to ${EXPORT_SCHEMA}`)
  }
  const nodes = payload.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind as CodeChart['nodes'][number]['kind'],
    file: n.file,
    module: n.module,
    row: n.row,
    excerpt: n.excerpt,
    inbound: n.inbound,
    outbound: n.outbound,
    x: 0,
    y: 0,
  }))
  return {
    nodes,
    edges: payload.edges,
    modules: payload.modules,
    fileCount: new Set(nodes.map((n) => n.file)).size,
    unresolvedCalls: 0,
    precise: false,
  }
}
