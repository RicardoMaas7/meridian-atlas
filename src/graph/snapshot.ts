import type { ChartNode, CodeChart } from '../types'

/**
 * Survey log: each charted folder leaves a snapshot in localStorage, so the
 * next survey of the same waters opens with "what changed since last time".
 */

export interface SurveySnapshot {
  title: string
  takenAt: number
  /** symbol key → excerpt hash */
  entries: Record<string, number>
  nodeCount: number
  edgeCount: number
  rockCount: number
  score: number
  grade: string
}

export interface SurveyDelta {
  prevTakenAt: number
  prevGrade: string
  prevRockCount: number
  added: ChartNode[]
  removed: string[]
  altered: ChartNode[]
}

const STORE_PREFIX = 'meridian:survey:'

export function symbolKey(n: { file: string; name: string; kind: string }): string {
  return `${n.file}::${n.name}::${n.kind}`
}

function hashText(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return h
}

/**
 * Seaworthiness: a single letter for the state of the waters.
 * Penalties: rocks (likely dead code), estimated routes (name collisions),
 * expeditions (symbols fanning out too widely).
 */
export function gradeChart(chart: CodeChart): { score: number; grade: string } {
  const n = chart.nodes.length || 1
  const e = chart.edges.length || 1
  const rocksPct = (chart.nodes.filter((x) => x.inbound === 0 && x.outbound === 0).length / n) * 100
  const estPct = (chart.edges.filter((x) => !x.charted).length / e) * 100
  const expeditions = chart.nodes.filter((x) => x.outbound >= 10).length
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - rocksPct * 0.6 - estPct * 0.4 - expeditions * 4)),
  )
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'E'
  return { score, grade }
}

export function snapshotOf(chart: CodeChart, title: string): SurveySnapshot {
  const entries: Record<string, number> = {}
  for (const node of chart.nodes) entries[symbolKey(node)] = hashText(node.excerpt)
  const { score, grade } = gradeChart(chart)
  return {
    title,
    takenAt: Date.now(),
    entries,
    nodeCount: chart.nodes.length,
    edgeCount: chart.edges.length,
    rockCount: chart.nodes.filter((x) => x.inbound === 0 && x.outbound === 0).length,
    score,
    grade,
  }
}

export function loadPrevious(title: string): SurveySnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + title)
    return raw ? (JSON.parse(raw) as SurveySnapshot) : null
  } catch {
    return null
  }
}

export function persist(snapshot: SurveySnapshot): void {
  try {
    localStorage.setItem(STORE_PREFIX + snapshot.title, JSON.stringify(snapshot))
  } catch {
    // quota exceeded on a huge repo: the log is a convenience, not a requirement
  }
}

export function diffAgainst(prev: SurveySnapshot, chart: CodeChart): SurveyDelta {
  const added: ChartNode[] = []
  const altered: ChartNode[] = []
  const seen = new Set<string>()
  for (const node of chart.nodes) {
    const key = symbolKey(node)
    seen.add(key)
    const prevHash = prev.entries[key]
    if (prevHash === undefined) added.push(node)
    else if (prevHash !== hashText(node.excerpt)) altered.push(node)
  }
  const removed = Object.keys(prev.entries)
    .filter((key) => !seen.has(key))
    .map((key) => {
      const [file, name] = key.split('::')
      return file ? `${name} (${file})` : name
    })
  return {
    prevTakenAt: prev.takenAt,
    prevGrade: prev.grade,
    prevRockCount: prev.rockCount,
    added,
    removed,
    altered,
  }
}

export function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'moments ago'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}
