import { Query } from 'web-tree-sitter'
import type { Node as TSNode } from 'web-tree-sitter'
import type { CallRef, Decl, FileEntry, LangId } from '../types'
import { createParser, getLanguage } from './loader'
import { LANGUAGES } from './languages'

const EXCERPT_MAX_LINES = 32

interface ExtractResult {
  decls: Decl[]
  calls: CallRef[]
}

const declQueries = new Map<LangId, Query>()
const callQueries = new Map<LangId, Query>()

async function queriesFor(lang: LangId): Promise<{ decl: Query; call: Query }> {
  let decl = declQueries.get(lang)
  let call = callQueries.get(lang)
  if (!decl || !call) {
    const language = await getLanguage(lang)
    const spec = LANGUAGES[lang]
    decl = new Query(language, spec.declQuery)
    call = new Query(language, spec.callQuery)
    declQueries.set(lang, decl)
    callQueries.set(lang, call)
  }
  return { decl, call }
}

function moduleOf(path: string): string {
  const parts = path.split('/')
  if (parts.length === 1) return '/'
  // Use up to two leading directories as the "sea" the symbol belongs to.
  return parts.slice(0, Math.min(2, parts.length - 1)).join('/')
}

function excerptAt(text: string, startIndex: number, endIndex: number): string {
  const slice = text.slice(startIndex, endIndex)
  const lines = slice.split('\n')
  if (lines.length <= EXCERPT_MAX_LINES) return slice
  return lines.slice(0, EXCERPT_MAX_LINES).join('\n') + '\n  …'
}

export async function extractFile(
  file: FileEntry,
  nextId: () => number,
): Promise<ExtractResult> {
  const spec = LANGUAGES[file.lang]
  let parser
  try {
    parser = await createParser(file.lang)
  } catch (err) {
    if (typeof console !== 'undefined') console.warn(`[meridian] parser init failed for ${file.path}:`, err)
    return { decls: [], calls: [] }
  }
  let tree
  try {
    tree = parser.parse(file.text)
  } catch (err) {
    parser.delete()
    if (typeof console !== 'undefined') console.warn(`[meridian] parse failed for ${file.path}:`, err)
    return { decls: [], calls: [] }
  }
  parser.delete()
  if (!tree) return { decls: [], calls: [] }

  let queries
  try {
    queries = await queriesFor(file.lang)
  } catch (err) {
    tree.delete()
    if (typeof console !== 'undefined') console.warn(`[meridian] query init failed for ${file.path}:`, err)
    return { decls: [], calls: [] }
  }
  const { decl: declQuery, call: callQuery } = queries

  const decls: Decl[] = []
  const declNodes: { decl: Decl; start: number; end: number }[] = []

  try {
    for (const capture of declQuery.captures(tree.rootNode)) {
      let kind = capture.name.replace('def.', '') as Decl['kind']
      const nameNode = capture.node
      // The span that "owns" inner calls is the whole declaration, not just the name.
      const body = enclosingDeclaration(nameNode, spec.declNodeTypes)
      // In Python/Rust/C++ a function nested in a class/impl is really a method.
      if (kind === 'function' && spec.classAncestors.length > 0) {
        if (hasAncestor(nameNode, spec.classAncestors)) kind = 'method'
      }
      const decl: Decl = {
        id: nextId(),
        name: nameNode.text,
        kind,
        file: file.path,
        module: moduleOf(file.path),
        row: nameNode.startPosition.row + 1,
        excerpt: excerptAt(file.text, body.startIndex, body.endIndex),
      }
      decls.push(decl)
      declNodes.push({ decl, start: body.startIndex, end: body.endIndex })
    }

    // Innermost-enclosing lookup: sort by span start, ties broken by larger span first.
    declNodes.sort((a, b) => a.start - b.start || b.end - a.end)

    const calls: CallRef[] = []
    for (const capture of callQuery.captures(tree.rootNode)) {
      const owner = innermostOwner(declNodes, capture.node.startIndex)
      if (!owner) continue // top-level call; not charted in the MVP
      if (capture.node.text === owner.name) continue // direct recursion: skip self-loops
      calls.push({
        fromDecl: owner.id,
        name: capture.node.text,
        kind: capture.name.replace('call.', '') as CallRef['kind'],
        file: file.path,
        row: capture.node.startPosition.row,
        col: capture.node.startPosition.column,
      })
    }

    tree.delete()
    return { decls, calls }
  } catch (err) {
    tree.delete()
    if (typeof console !== 'undefined') console.warn(`[meridian] extraction failed for ${file.path}:`, err)
    return { decls: [], calls: [] }
  }
}

function enclosingDeclaration(nameNode: TSNode, declNodeTypes: string[]): TSNode {
  let node: TSNode | null = nameNode
  while (node) {
    if (declNodeTypes.includes(node.type)) return node
    node = node.parent
  }
  return nameNode
}

function hasAncestor(node: TSNode, types: string[]): boolean {
  let current: TSNode | null = node.parent
  while (current) {
    if (types.includes(current.type)) return true
    current = current.parent
  }
  return false
}

function innermostOwner(
  declNodes: { decl: Decl; start: number; end: number }[],
  index: number,
): Decl | null {
  let owner: Decl | null = null
  for (const { decl, start, end } of declNodes) {
    if (start > index) break
    if (index >= start && index < end) owner = decl // later matches are inner spans
  }
  return owner
}
