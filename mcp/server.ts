#!/usr/bin/env node
// Meridian MCP server: the same survey the browser draws, readable by agents.
// Tools: survey (chart a directory, report the delta), symbol (one symbol's routes).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type { ChartNode, CodeChart } from '../src/types'
import { buildChart } from '../src/graph/build'
import { interpretChart, interpretNode } from '../src/graph/interpret'
import {
  diffAgainst,
  gradeChart,
  relativeTime,
  snapshotOf,
  type SurveySnapshot,
} from '../src/graph/snapshot'
import { configureLoader } from '../src/parser/loader'
import { scanDirectory } from './scan'
import { tryPreciseResolver } from './scip'

// The bundle lives in dist-mcp/; grammars stay in public/wasm. The runtime
// wasm is left to emscripten, which finds it inside node_modules.
const WASM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wasm')
configureLoader({ grammarPath: (file) => join(WASM_DIR, file) })

const SURVEY_DIR = join(homedir(), '.meridian', 'surveys')

function surveyPath(directory: string): string {
  const key = createHash('sha256').update(directory).digest('hex').slice(0, 16)
  return join(SURVEY_DIR, `${key}.json`)
}

function loadPrevious(directory: string): SurveySnapshot | null {
  try {
    return JSON.parse(readFileSync(surveyPath(directory), 'utf8')) as SurveySnapshot
  } catch {
    return null
  }
}

function persist(directory: string, snapshot: SurveySnapshot): void {
  try {
    mkdirSync(SURVEY_DIR, { recursive: true })
    writeFileSync(surveyPath(directory), JSON.stringify(snapshot))
  } catch {
    // the log is a convenience, not a requirement
  }
}

// Charts are cached per directory so `symbol` calls after a survey are free.
const charts = new Map<string, CodeChart>()

async function chartOf(directory: string): Promise<CodeChart> {
  let chart = charts.get(directory)
  if (!chart) {
    chart = await buildChart(scanDirectory(directory), undefined, tryPreciseResolver(directory) ?? undefined)
    charts.set(directory, chart)
  }
  return chart
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function mark(node: ChartNode): string {
  return `${node.name} (${node.file}:${node.row})`
}

function listMarks(nodes: ChartNode[], limit: number): string {
  const shown = nodes.slice(0, limit).map(mark)
  if (nodes.length > limit) shown.push(`and ${nodes.length - limit} more`)
  return shown.join('; ')
}

function renderSurvey(directory: string, chart: CodeChart, prev: SurveySnapshot | null): string {
  const { score, grade } = gradeChart(chart)
  const lines: string[] = []
  lines.push(`SURVEY — ${directory}`)
  lines.push(
    `${chart.nodes.length} symbols, ${chart.edges.length} routes, ` +
      `${chart.fileCount} files, ${chart.modules.length} module${chart.modules.length === 1 ? '' : 's'}. ` +
      `Seaworthiness ${grade} (${score})${prev && prev.grade !== grade ? ` — was ${prev.grade}` : ''}. ` +
      `${chart.unresolvedCalls} calls lead off the chart.`,
  )
  if (chart.precise) {
    lines.push('Cross-file routes resolved precisely by SCIP — no name guessing.')
  }
  lines.push('')

  if (prev) {
    const delta = diffAgainst(prev, chart)
    lines.push(
      `Since last survey (${relativeTime(delta.prevTakenAt)}): ` +
        `${delta.added.length} new, ${delta.altered.length} altered, ${delta.removed.length} removed.`,
    )
    if (delta.added.length > 0) lines.push(`  New: ${listMarks(delta.added, 8)}`)
    if (delta.altered.length > 0) lines.push(`  Altered: ${listMarks(delta.altered, 8)}`)
    if (delta.removed.length > 0) lines.push(`  Removed: ${delta.removed.slice(0, 8).join(', ')}`)
    lines.push('')
  } else {
    lines.push('First survey of these waters.')
    lines.push('')
  }

  const byId = new Map(chart.nodes.map((n) => [n.id, n]))
  const observations = interpretChart(chart)
  if (observations.length > 0) {
    lines.push('REMARKS')
    observations.forEach((obs, i) => {
      lines.push(`${(ROMAN[i] ?? String(i + 1)).padStart(4)}. ${obs.title}. ${obs.body}`)
      if (obs.refs && obs.refs.length > 0) {
        const refs = obs.refs.map((ref) => {
          const node = byId.get(ref.id)
          return node ? `${ref.name} — ${node.file}:${node.row}` : ref.name
        })
        lines.push(`      ${refs.join('; ')}`)
      }
    })
  }
  return lines.join('\n')
}

function renderSymbol(chart: CodeChart, node: ChartNode): string {
  const byId = new Map(chart.nodes.map((n) => [n.id, n]))
  const callers = chart.edges
    .filter((e) => e.target === node.id)
    .map((e) => ({ node: byId.get(e.source), charted: e.charted }))
  const callees = chart.edges
    .filter((e) => e.source === node.id)
    .map((e) => ({ node: byId.get(e.target), charted: e.charted }))

  const route = (r: { node: ChartNode | undefined; charted: boolean }) =>
    r.node ? `${mark(r.node)}${r.charted ? '' : ' [estimated]'}` : null

  const lines: string[] = []
  lines.push(`${node.name} — ${node.kind}, ${node.file}:${node.row}. ${node.inbound} in, ${node.outbound} out.`)
  const reading = interpretNode(chart, node)
  if (reading) lines.push(reading)
  lines.push(
    callers.length > 0
      ? `Called by: ${callers.map(route).filter(Boolean).join('; ')}`
      : 'Called by nothing surveyed.',
  )
  lines.push(
    callees.length > 0
      ? `Calls: ${callees.map(route).filter(Boolean).join('; ')}`
      : 'No routes set out from it.',
  )
  lines.push('', node.excerpt)
  return lines.join('\n')
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

const server = new McpServer({ name: 'meridian', version: '0.1.0' })

server.registerTool(
  'survey',
  {
    title: 'Survey a directory',
    description:
      'Parse a local source directory (9 languages, tree-sitter) and chart its call graph. ' +
      'Returns the title block (symbols, routes, seaworthiness grade A–E), what changed since ' +
      'the last survey of the same directory, and numbered remarks: islands, lighthouses, ' +
      'entry points, dead code, cross-module coupling. Every reference is file:line. ' +
      'Run it again after editing code to read the delta.',
    inputSchema: { directory: z.string().describe('Absolute path of the directory to survey') },
  },
  async ({ directory }) => {
    const dir = resolve(directory)
    if (!existsSync(dir)) return fail(`No such directory: ${dir}`)
    const files = scanDirectory(dir)
    if (files.length === 0) return fail(`Nothing to chart in ${dir}: no parseable source files.`)
    const chart = await buildChart(files, undefined, tryPreciseResolver(dir) ?? undefined)
    charts.set(dir, chart)
    const prev = loadPrevious(dir)
    persist(dir, snapshotOf(chart, dir))
    return { content: [{ type: 'text' as const, text: renderSurvey(dir, chart, prev) }] }
  },
)

server.registerTool(
  'symbol',
  {
    title: 'Read one symbol',
    description:
      'Look up a symbol by name on the chart of a directory: kind, position, callers, callees ' +
      '(with file:line), and its source excerpt. Surveys the directory first if it has not been ' +
      'surveyed in this session.',
    inputSchema: {
      directory: z.string().describe('Absolute path of the surveyed directory'),
      name: z.string().describe('Exact symbol name, e.g. buildChart'),
      file: z.string().optional().describe('Narrow to symbols whose file path contains this'),
    },
  },
  async ({ directory, name, file }) => {
    const dir = resolve(directory)
    if (!existsSync(dir)) return fail(`No such directory: ${dir}`)
    const chart = await chartOf(dir)
    let matches = chart.nodes.filter((n) => n.name === name)
    if (file) matches = matches.filter((n) => n.file.includes(file))
    if (matches.length === 0) {
      const near = chart.nodes.filter((n) => n.name.toLowerCase() === name.toLowerCase())
      return fail(
        `No symbol named ${name} on the chart.` +
          (near.length > 0 ? ` Did you mean: ${near.map(mark).join('; ')}` : ''),
      )
    }
    const text = matches
      .slice(0, 5)
      .map((n) => renderSymbol(chart, n))
      .join('\n\n― ― ―\n\n')
    return { content: [{ type: 'text' as const, text }] }
  },
)

await server.connect(new StdioServerTransport())
