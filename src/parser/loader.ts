import { Parser, Language } from 'web-tree-sitter'
import type { LangId } from '../types'
import { LANGUAGES } from './languages'

export { langForPath, langForPathWithContent } from './languages'

let initialized = false
const languages = new Map<LangId, Language>()

// Browser default: grammars and the runtime are served from /wasm. The MCP
// server (Node) overrides the grammar path and lets emscripten find its own
// runtime in node_modules.
let grammarPath: (file: string) => string = (file) => `/wasm/${file}`
let runtimePath: ((file: string) => string) | undefined = (file) => `/wasm/${file}`

export function configureLoader(opts: {
  grammarPath: (file: string) => string
  runtimePath?: (file: string) => string
}): void {
  grammarPath = opts.grammarPath
  runtimePath = opts.runtimePath
}

async function ensureInit(): Promise<void> {
  if (initialized) return
  await Parser.init(runtimePath ? { locateFile: runtimePath } : undefined)
  initialized = true
}

export async function getLanguage(lang: LangId): Promise<Language> {
  await ensureInit()
  let language = languages.get(lang)
  if (!language) {
    language = await Language.load(grammarPath(LANGUAGES[lang].grammar))
    languages.set(lang, language)
  }
  return language
}

export async function createParser(lang: LangId): Promise<Parser> {
  const language = await getLanguage(lang)
  const parser = new Parser()
  parser.setLanguage(language)
  return parser
}
