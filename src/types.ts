export type LangId =
  | 'typescript'
  | 'tsx'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'

export interface FileEntry {
  path: string
  text: string
  lang: LangId
}

export type DeclKind = 'function' | 'method' | 'class' | 'var'

export interface Decl {
  id: number
  name: string
  kind: DeclKind
  file: string
  module: string
  row: number
  excerpt: string
}

export interface CallRef {
  fromDecl: number
  name: string
  kind: 'name' | 'method' | 'new'
  /** Call-site position (0-based), so a precise indexer can be asked what it binds to. */
  file: string
  row: number
  col: number
}

export interface ChartEdge {
  source: number
  target: number
  /** true: resolved within file or unambiguous — a charted route. false: heuristic — an estimated route, drawn dashed. */
  charted: boolean
}

export interface ChartNode extends Decl {
  inbound: number
  outbound: number
  x: number
  y: number
}

export interface CodeChart {
  nodes: ChartNode[]
  edges: ChartEdge[]
  modules: string[]
  fileCount: number
  unresolvedCalls: number
  /** True when at least one file's cross-file calls were resolved by a precise indexer (SCIP). */
  precise: boolean
}
