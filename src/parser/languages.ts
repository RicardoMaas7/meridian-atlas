import type { LangId } from '../types'

export interface LanguageSpec {
  /** wasm filename under /wasm/ */
  grammar: string
  extensions: string[]
  /** tree-sitter query for declarations; capture names: def.function / def.method / def.class / def.var */
  declQuery: string
  /** tree-sitter query for call sites; capture names: call.name / call.method / call.new */
  callQuery: string
  /** node types that own inner calls (used to attribute a call to its enclosing declaration) */
  declNodeTypes: string[]
  /** ancestor node types that turn a def.function into a def.method (e.g. Python defs inside a class) */
  classAncestors: string[]
}

const TS_DECLS = (classNameNode: string) => `
  (function_declaration name: (identifier) @def.function)
  (variable_declarator
    name: (identifier) @def.var
    value: [(arrow_function) (function_expression)])
  (method_definition name: (property_identifier) @def.method)
  (class_declaration name: (${classNameNode}) @def.class)
`

const TS_CALLS = `
  (call_expression function: (identifier) @call.name)
  (call_expression
    function: (member_expression property: (property_identifier) @call.method))
  (new_expression constructor: (identifier) @call.new)
`

const TS_DECL_NODES = [
  'function_declaration',
  'method_definition',
  'class_declaration',
  'variable_declarator',
]

export const LANGUAGES: Record<LangId, LanguageSpec> = {
  typescript: {
    grammar: 'tree-sitter-typescript.wasm',
    extensions: ['.ts', '.mts', '.cts'],
    declQuery: TS_DECLS('type_identifier'),
    callQuery: TS_CALLS,
    declNodeTypes: TS_DECL_NODES,
    classAncestors: [],
  },
  tsx: {
    grammar: 'tree-sitter-tsx.wasm',
    extensions: ['.tsx'],
    declQuery: TS_DECLS('type_identifier'),
    callQuery: TS_CALLS,
    declNodeTypes: TS_DECL_NODES,
    classAncestors: [],
  },
  javascript: {
    grammar: 'tree-sitter-javascript.wasm',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    declQuery: TS_DECLS('identifier'),
    callQuery: TS_CALLS,
    declNodeTypes: TS_DECL_NODES,
    classAncestors: [],
  },
  python: {
    grammar: 'tree-sitter-python.wasm',
    extensions: ['.py'],
    declQuery: `
      (function_definition name: (identifier) @def.function)
      (class_definition name: (identifier) @def.class)
    `,
    callQuery: `
      (call function: (identifier) @call.name)
      (call function: (attribute attribute: (identifier) @call.method))
    `,
    declNodeTypes: ['function_definition', 'class_definition'],
    classAncestors: ['class_definition'],
  },
  go: {
    grammar: 'tree-sitter-go.wasm',
    extensions: ['.go'],
    declQuery: `
      (function_declaration name: (identifier) @def.function)
      (method_declaration name: (field_identifier) @def.method)
      (type_spec name: (type_identifier) @def.class type: (struct_type))
    `,
    callQuery: `
      (call_expression function: (identifier) @call.name)
      (call_expression
        function: (selector_expression field: (field_identifier) @call.method))
    `,
    declNodeTypes: ['function_declaration', 'method_declaration', 'type_spec'],
    classAncestors: [],
  },
  rust: {
    grammar: 'tree-sitter-rust.wasm',
    extensions: ['.rs'],
    declQuery: `
      (function_item name: (identifier) @def.function)
      (struct_item name: (type_identifier) @def.class)
      (enum_item name: (type_identifier) @def.class)
    `,
    callQuery: `
      (call_expression function: (identifier) @call.name)
      (call_expression
        function: (field_expression field: (field_identifier) @call.method))
      (call_expression
        function: (scoped_identifier name: (identifier) @call.method))
    `,
    declNodeTypes: ['function_item', 'struct_item', 'enum_item'],
    classAncestors: ['impl_item', 'trait_item'],
  },
  java: {
    grammar: 'tree-sitter-java.wasm',
    extensions: ['.java'],
    declQuery: `
      (method_declaration name: (identifier) @def.method)
      (constructor_declaration name: (identifier) @def.method)
      (class_declaration name: (identifier) @def.class)
      (interface_declaration name: (identifier) @def.class)
    `,
    callQuery: `
      (method_invocation name: (identifier) @call.method)
      (object_creation_expression type: (type_identifier) @call.new)
    `,
    declNodeTypes: [
      'method_declaration',
      'constructor_declaration',
      'class_declaration',
      'interface_declaration',
    ],
    classAncestors: [],
  },
  c: {
    grammar: 'tree-sitter-c.wasm',
    extensions: ['.c', '.h'],
    declQuery: `
      (function_definition
        declarator: (function_declarator declarator: (identifier) @def.function))
      (function_definition
        declarator: (pointer_declarator
          declarator: (function_declarator declarator: (identifier) @def.function)))
    `,
    callQuery: `
      (call_expression function: (identifier) @call.name)
    `,
    declNodeTypes: ['function_definition'],
    classAncestors: [],
  },
  cpp: {
    grammar: 'tree-sitter-cpp.wasm',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh'],
    declQuery: `
      (function_definition
        declarator: (function_declarator declarator: (identifier) @def.function))
      (function_definition
        declarator: (function_declarator declarator: (field_identifier) @def.method))
      (function_definition
        declarator: (function_declarator
          declarator: (qualified_identifier name: (identifier) @def.method)))
      (class_specifier name: (type_identifier) @def.class)
      (struct_specifier name: (type_identifier) @def.class)
    `,
    callQuery: `
      (call_expression function: (identifier) @call.name)
      (call_expression
        function: (field_expression field: (field_identifier) @call.method))
      (call_expression
        function: (qualified_identifier name: (identifier) @call.method))
    `,
    declNodeTypes: ['function_definition', 'class_specifier', 'struct_specifier'],
    classAncestors: ['class_specifier', 'struct_specifier'],
  },
}

const EXT_TO_LANG = new Map<string, LangId>()
for (const [lang, spec] of Object.entries(LANGUAGES) as [LangId, LanguageSpec][]) {
  for (const ext of spec.extensions) EXT_TO_LANG.set(ext, lang)
}

export function langForPath(path: string): LangId | null {
  if (path.endsWith('.d.ts')) return null
  const dot = path.lastIndexOf('.')
  if (dot < 0) return null
  return EXT_TO_LANG.get(path.slice(dot).toLowerCase()) ?? null
}

// `.h` files are ambiguous: C projects use them as C headers, C++ projects
// as C++ headers. The grammar is also ambiguous — tree-sitter-cpp can parse
// a plain C header, but tree-sitter-c will fail on `class`/`template`/
// `namespace`. When we have the text, sniff for C++ markers in the first
// few hundred lines and prefer the C++ grammar in that case.
const CPP_HEADER_HINTS = [
  /^\s*#\s*include\s*<[a-z_]+>/m,
  /^\s*(class|struct|namespace)\s+\w+/m,
  /^\s*template\s*</m,
  /::\s*\w+\s*\(/m,
]

export function langForPathWithContent(path: string, text?: string): LangId | null {
  const base = langForPath(path)
  if (base !== 'c' || !text) return base
  if (!path.toLowerCase().endsWith('.h')) return base
  const head = text.slice(0, 8000)
  for (const re of CPP_HEADER_HINTS) {
    if (re.test(head)) return 'cpp'
  }
  return 'c'
}

export const SUPPORTED_LANGS_LABEL =
  'TypeScript · JavaScript · Python · Go · Rust · Java · C · C++'
