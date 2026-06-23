// Optional precision layer for the MCP/CLI survey: run scip-typescript over a
// TypeScript/JavaScript project and hand the graph builder a precise resolver.
// Everything here degrades to null — if the tool is absent, the project isn't
// TS/JS, or indexing fails, the survey falls back to the heuristic resolver.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildResolver, type PreciseResolver, type ScipIndex } from '../src/graph/scip'

const require = createRequire(import.meta.url)

/** Locate the scip-typescript CLI, if it was installed (an optional dependency). */
function scipTypescriptBin(): string | null {
  try {
    // The package's own entrypoint resolves; the CLI sits beside it in dist.
    const pkg = require.resolve('@sourcegraph/scip-typescript/package.json')
    const bin = join(pkg, '..', 'dist', 'src', 'main.js')
    return existsSync(bin) ? bin : null
  } catch {
    return null
  }
}

/** Deserialize an index.scip into the plain object shape buildResolver reads. */
function readIndex(path: string): ScipIndex {
  // The protobuf reader ships with scip-typescript; reuse it rather than vendor a copy.
  const { scip } = require('@sourcegraph/scip-typescript/dist/src/scip.js') as {
    scip: { Index: { deserialize(buf: Buffer): ScipIndex } }
  }
  return scip.Index.deserialize(readFileSync(path))
}

/**
 * Try to build a precise resolver for `directory`. Returns null when precision
 * is unavailable, leaving the heuristic path untouched.
 */
export function tryPreciseResolver(directory: string): PreciseResolver | null {
  const isTsJsProject =
    existsSync(join(directory, 'package.json')) || existsSync(join(directory, 'tsconfig.json'))
  if (!isTsJsProject) return null

  const bin = scipTypescriptBin()
  if (!bin) return null

  const work = mkdtempSync(join(tmpdir(), 'meridian-scip-'))
  const out = join(work, 'index.scip')
  try {
    const hasTsconfig = existsSync(join(directory, 'tsconfig.json'))
    const args = [bin, 'index', '--output', out]
    if (!hasTsconfig) args.push('--infer-tsconfig')
    const result = spawnSync(process.execPath, args, {
      cwd: directory,
      stdio: 'ignore',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    if (result.status !== 0 || !existsSync(out)) return null
    return buildResolver(readIndex(out))
  } catch {
    return null
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
