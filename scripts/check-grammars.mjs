// Validates every language spec offline: loads the wasm grammar, compiles the
// decl/call queries, parses a sample, and prints what was captured.
// Run: node scripts/check-grammars.mjs
import { Parser, Language, Query } from 'web-tree-sitter'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// Keep these query strings in sync with src/parser/languages.ts (read from source).
const source = readFileSync(join(root, 'src/parser/languages.ts'), 'utf8')

const SAMPLES = {
  typescript: `
function alpha(): number { return beta() + 1 }
function beta(): number { return 2 }
const gamma = () => alpha()
class Engine {
  start(): void { this.prime() }
  prime(): void { beta() }
}
new Engine()
`,
  tsx: `
function Widget() { return <div onClick={() => handler()}>hi</div> }
function handler() { return 1 }
`,
  javascript: `
function alpha() { return beta() }
function beta() { return 1 }
class Boat { sail() { alpha() } }
new Boat()
`,
  python: `
def alpha():
    return beta()

def beta():
    return 1

class Engine:
    def start(self):
        self.prime()
        alpha()
    def prime(self):
        return helpers.tune()
`,
  go: `
package main

type Engine struct{ rpm int }

func (e *Engine) Start() { e.prime() }
func (e *Engine) prime() { tune() }
func tune() {}
func main() {
    e := &Engine{}
    e.Start()
    pkg.Helper()
}
`,
  rust: `
struct Engine { rpm: u32 }
enum State { On, Off }
impl Engine {
    fn start(&self) { self.prime(); }
    fn prime(&self) { tune(); }
}
fn tune() {}
fn main() {
    let e = Engine { rpm: 0 };
    e.start();
    Engine::new();
    helpers::align();
}
`,
  java: `
public class Engine {
    private int rpm;
    public Engine() { this.rpm = 0; }
    public void start() { prime(); }
    private void prime() { Tuner t = new Tuner(); t.tune(); }
}
interface Tunable { void tune(); }
`,
  c: `
static int prime(int x) { return x * 2; }
int *make_buffer(int n) { return 0; }
int start(void) { return prime(3); }
int main(void) { return start(); }
`,
  cpp: `
class Engine {
public:
    void start() { prime(); }
private:
    void prime();
};
void Engine::prime() { tune(); }
void tune() {}
struct Gauge { int psi; };
int main() {
    Engine e;
    e.start();
    Engine::prime();
    return 0;
}
`,
}

function getQueries(lang) {
  // Crude but effective: evaluate the LANGUAGES literal by transpiling the
  // bits we need. Instead, re-extract via regex per language block.
  const block = source.split(`${lang}: {`)[1]?.split('\n  },')[0]
  if (!block) throw new Error(`no spec block for ${lang}`)
  const decl = block.split('declQuery: `')[1]?.split('`')[0]
  const call = block.split('callQuery: `')[1]?.split('`')[0]
  const grammar = block.split(`grammar: '`)[1]?.split(`'`)[0]
  if (!decl || !call || !grammar) throw new Error(`incomplete spec for ${lang}`)
  return { decl, call, grammar }
}

await Parser.init()
let failures = 0

for (const [lang, sample] of Object.entries(SAMPLES)) {
  // TS_DECLS/TS_CALLS templates are shared; resolve them specially.
  let decl, call, grammar
  if (lang === 'typescript' || lang === 'tsx' || lang === 'javascript') {
    const classNode = lang === 'javascript' ? 'identifier' : 'type_identifier'
    decl = `
      (function_declaration name: (identifier) @def.function)
      (variable_declarator name: (identifier) @def.var value: [(arrow_function) (function_expression)])
      (method_definition name: (property_identifier) @def.method)
      (class_declaration name: (${classNode}) @def.class)
    `
    call = `
      (call_expression function: (identifier) @call.name)
      (call_expression function: (member_expression property: (property_identifier) @call.method))
      (new_expression constructor: (identifier) @call.new)
    `
    grammar = `tree-sitter-${lang}.wasm`
  } else {
    ;({ decl, call, grammar } = getQueries(lang))
  }

  try {
    const language = await Language.load(join(root, 'public/wasm', grammar))
    const parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(sample)
    const dq = new Query(language, decl)
    const cq = new Query(language, call)
    const decls = dq.captures(tree.rootNode).map((c) => `${c.name.slice(4)}:${c.node.text}`)
    const calls = cq.captures(tree.rootNode).map((c) => `${c.name.slice(5)}:${c.node.text}`)
    console.log(`✔ ${lang.padEnd(11)} decls [${decls.join(' ')}]`)
    console.log(`  ${''.padEnd(11)} calls [${calls.join(' ')}]`)
    if (decls.length === 0 || calls.length === 0) {
      console.log(`  ⚠ ${lang}: empty capture set`)
      failures++
    }
  } catch (err) {
    console.error(`✘ ${lang}: ${err.message}`)
    failures++
  }
}

process.exit(failures ? 1 : 0)
