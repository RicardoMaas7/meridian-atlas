import { Parser, Language } from 'web-tree-sitter'
import type { LangId } from '../types'
import { LANGUAGES } from './languages'

export { langForPath } from './languages'

let initialized = false
const languages = new Map<LangId, Language>()

async function ensureInit(): Promise<void> {
  if (initialized) return
  await Parser.init({
    locateFile: (file: string) => `/wasm/${file}`,
  })
  initialized = true
}

export async function getLanguage(lang: LangId): Promise<Language> {
  await ensureInit()
  let language = languages.get(lang)
  if (!language) {
    language = await Language.load(`/wasm/${LANGUAGES[lang].grammar}`)
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
