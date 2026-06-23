import type { CallRef, ChartEdge, ChartNode, CodeChart, Decl, FileEntry } from '../types'
import { extractFile } from '../parser/extract'
import type { PreciseResolver } from './scip'

const MAX_DASHED_CANDIDATES = 8

export async function buildChart(
  files: FileEntry[],
  onProgress?: (done: number, total: number) => void,
  precise?: PreciseResolver,
): Promise<CodeChart> {
  let counter = 0
  const nextId = () => counter++

  const decls: Decl[] = []
  const calls: CallRef[] = []

  for (let i = 0; i < files.length; i++) {
    const result = await extractFile(files[i], nextId)
    decls.push(...result.decls)
    calls.push(...result.calls)
    onProgress?.(i + 1, files.length)
    if (i % 25 === 24) await new Promise((r) => setTimeout(r)) // keep the UI breathing
  }

  // Name → candidate declarations, split by how a call site can reach them.
  const byName = new Map<string, Decl[]>()
  const methodsByName = new Map<string, Decl[]>()
  const byFile = new Map<string, Map<string, Decl[]>>()
  for (const d of decls) {
    const table = d.kind === 'method' ? methodsByName : byName
    let list = table.get(d.name)
    if (!list) table.set(d.name, (list = []))
    list.push(d)

    let fileTable = byFile.get(d.file)
    if (!fileTable) byFile.set(d.file, (fileTable = new Map()))
    let fileList = fileTable.get(d.name)
    if (!fileList) fileTable.set(d.name, (fileList = []))
    fileList.push(d)
  }

  const declById = new Map(decls.map((d) => [d.id, d]))
  const declByLoc = new Map<string, Decl[]>()
  for (const d of decls) {
    const key = `${d.file}:${d.row}`
    let list = declByLoc.get(key)
    if (!list) declByLoc.set(key, (list = []))
    list.push(d)
  }
  const declAt = (file: string, row: number, name: string): Decl | undefined => {
    const list = declByLoc.get(`${file}:${row}`)
    if (!list) return undefined
    return list.find((d) => d.name === name) ?? list[0]
  }

  const edgeKeys = new Set<string>()
  const edges: ChartEdge[] = []
  let unresolved = 0

  const addEdge = (source: number, target: number, charted: boolean) => {
    if (source === target) return
    const key = `${source}→${target}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ source, target, charted })
  }

  for (const call of calls) {
    const from = declById.get(call.fromDecl)
    if (!from) continue

    // 0. Precise
    if (precise?.covers(call.file)) {
      const target = precise.resolve(call.file, call.row, call.col, call.name)
      const targetDecl = target && declAt(target.file, target.row, call.name)
      if (targetDecl) addEdge(from.id, targetDecl.id, true)
      else unresolved++
      continue
    }

    // 1. Same file
    const local = byFile.get(from.file)?.get(call.name)
    const localTarget =
      local?.find((d) => (call.kind === 'method' ? d.kind === 'method' : d.kind !== 'method')) ??
      local?.[0]
    if (localTarget) {
      addEdge(from.id, localTarget.id, true)
      continue
    }

    // 2. Global by name
    const table = call.kind === 'method' ? methodsByName : byName
    let candidates = (table.get(call.name) ?? []).filter((d) => d.file !== from.file)
    if (candidates.length === 0 && call.kind === 'method') {
      candidates = (byName.get(call.name) ?? []).filter((d) => d.file !== from.file)
    }
    if (candidates.length === 1) {
      addEdge(from.id, candidates[0].id, true)
    } else if (candidates.length > 1 && candidates.length <= MAX_DASHED_CANDIDATES) {
      for (const candidate of candidates) addEdge(from.id, candidate.id, false)
    } else {
      unresolved++
    }
  }

  const inbound = new Map<number, number>()
  const outbound = new Map<number, number>()
  for (const e of edges) {
    outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1)
    inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1)
  }

  const nodes: ChartNode[] = decls.map((d) => ({
    ...d,
    inbound: inbound.get(d.id) ?? 0,
    outbound: outbound.get(d.id) ?? 0,
    x: 0,
    y: 0,
  }))

  const modules = [...new Set(nodes.map((n) => n.module))].sort()
  const preciseUsed = !!precise && files.some((f) => precise.covers(f.path))
  return {
    nodes,
    edges,
    modules,
    fileCount: files.length,
    unresolvedCalls: unresolved,
    precise: preciseUsed,
  }
}
