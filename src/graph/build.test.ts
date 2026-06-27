import { describe, it, expect, vi } from 'vitest'

// Mock the parser layer so we can exercise buildChart's resolution
// logic without booting tree-sitter WASM.
vi.mock('../parser/extract', () => ({
  extractFile: vi.fn(),
}))

import { buildChart } from './build'
import { extractFile } from '../parser/extract'
import type { CallRef, Decl, FileEntry } from '../types'

const mockedExtract = vi.mocked(extractFile)

function makeFile(path: string, lang: FileEntry['lang'] = 'typescript'): FileEntry {
  return { path, text: '', lang }
}

function decl(id: number, name: string, file: string, kind: Decl['kind'] = 'function', row = 1): Decl {
  return { id, name, kind, file, module: file.split('/')[0], row, excerpt: name }
}

function call(fromDecl: number, name: string, file: string, kind: CallRef['kind'] = 'name', row = 0, col = 0): CallRef {
  return { fromDecl, name, kind, file, row, col }
}

describe('buildChart', () => {
  it('returns an empty chart for no files', async () => {
    const chart = await buildChart([])
    expect(chart.nodes).toHaveLength(0)
    expect(chart.edges).toHaveLength(0)
    expect(chart.unresolvedCalls).toBe(0)
    expect(chart.fileCount).toBe(0)
  })

  it('forwards progress callbacks once per file', async () => {
    mockedExtract.mockResolvedValue({ decls: [], calls: [] })
    const onProgress = vi.fn()
    await buildChart([makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts')], onProgress)
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3)
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
  })

  it('keeps the survey going when one file throws', async () => {
    mockedExtract
      .mockResolvedValueOnce({ decls: [decl(0, 'alpha', 'a.ts')], calls: [] })
      .mockImplementationOnce(() => { throw new Error('boom') })
      .mockResolvedValueOnce({ decls: [decl(1, 'beta', 'b.ts')], calls: [] })

    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts')])
    expect(chart.nodes.map((n) => n.name).sort()).toEqual(['alpha', 'beta'])
  })

  it('resolves same-file calls as charted edges', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'a.ts')],
      calls: [call(0, 'target', 'a.ts')],
    })
    const chart = await buildChart([makeFile('a.ts')])
    expect(chart.edges).toEqual([{ source: 0, target: 1, charted: true }])
    expect(chart.unresolvedCalls).toBe(0)
  })

  it('prefers a same-file target whose kind matches the call kind', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [
        decl(0, 'caller', 'a.ts'),
        decl(1, 'helper', 'a.ts', 'function'),
        decl(2, 'helper', 'a.ts', 'method'),
      ],
      calls: [call(0, 'helper', 'a.ts', 'method')],
    })
    const chart = await buildChart([makeFile('a.ts')])
    expect(chart.edges).toEqual([{ source: 0, target: 2, charted: true }])
  })

  it('deduplicates repeated calls between the same pair', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'a.ts')],
      calls: [call(0, 'target', 'a.ts', 'name', 5, 0), call(0, 'target', 'a.ts', 'name', 7, 0)],
    })
    const chart = await buildChart([makeFile('a.ts')])
    expect(chart.edges).toHaveLength(1)
  })

  it('resolves a single cross-file candidate as a charted edge', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'b.ts')],
      calls: [call(0, 'target', 'a.ts')],
    })
    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts')])
    expect(chart.edges).toEqual([{ source: 0, target: 1, charted: true }])
  })

  it('marks multiple cross-file candidates as dashed (estimated) edges', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'b.ts'), decl(2, 'target', 'c.ts')],
      calls: [call(0, 'target', 'a.ts')],
    })
    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts')])
    expect(chart.edges).toHaveLength(2)
    expect(chart.edges.every((e) => e.charted === false)).toBe(true)
    expect(chart.unresolvedCalls).toBe(0)
  })

  it('counts a call as unresolved when there are too many candidates', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [
        decl(0, 'caller', 'a.ts'),
        ...Array.from({ length: 12 }, (_, i) => decl(i + 1, 'helper', `f${i}.ts`)),
      ],
      calls: [call(0, 'helper', 'a.ts')],
    })
    const files = [makeFile('a.ts'), ...Array.from({ length: 12 }, (_, i) => makeFile(`f${i}.ts`))]
    const chart = await buildChart(files)
    expect(chart.edges).toHaveLength(0)
    expect(chart.unresolvedCalls).toBe(1)
  })

  it('falls back to functions when a method call has no method candidates', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts', 'method'), decl(1, 'helper', 'b.ts', 'function')],
      calls: [call(0, 'helper', 'a.ts', 'method')],
    })
    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts')])
    expect(chart.edges).toEqual([{ source: 0, target: 1, charted: true }])
  })

  it('uses a precise resolver when it covers the call file', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'b.ts')],
      calls: [call(0, 'caller', 'a.ts', 'name', 10, 4)],
    })
    const precise = {
      covers: (_f: string) => true,
      resolve: (_f: string, _r: number, _c: number, _n: string) => ({ file: 'b.ts', row: 1 }),
    }
    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts')], undefined, precise)
    expect(chart.edges).toEqual([{ source: 0, target: 1, charted: true }])
    expect(chart.precise).toBe(true)
  })

  it('counts precise misses as unresolved instead of falling back', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'caller', 'a.ts'), decl(1, 'target', 'b.ts')],
      calls: [call(0, 'target', 'a.ts', 'name', 10, 0)],
    })
    const precise = {
      covers: (_f: string) => true,
      resolve: () => null,
    }
    const chart = await buildChart([makeFile('a.ts'), makeFile('b.ts')], undefined, precise)
    expect(chart.edges).toHaveLength(0)
    expect(chart.unresolvedCalls).toBe(1)
  })

  it('computes inbound and outbound counts', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [
        decl(0, 'a', 'a.ts'),
        decl(1, 'b', 'a.ts'),
        decl(2, 'c', 'a.ts'),
      ],
      calls: [
        call(0, 'c', 'a.ts'),
        call(1, 'c', 'a.ts'),
        call(2, 'a', 'a.ts'),
      ],
    })
    const chart = await buildChart([makeFile('a.ts')])
    const byName = new Map(chart.nodes.map((n) => [n.name, n]))
    expect(byName.get('a')!.outbound).toBe(1)
    expect(byName.get('a')!.inbound).toBe(1)
    expect(byName.get('b')!.outbound).toBe(1)
    expect(byName.get('b')!.inbound).toBe(0)
    expect(byName.get('c')!.inbound).toBe(2)
    expect(byName.get('c')!.outbound).toBe(1)
  })

  it('exposes the distinct module list sorted', async () => {
    mockedExtract.mockResolvedValueOnce({
      decls: [decl(0, 'f', 'z/foo.ts'), decl(1, 'g', 'a/bar.ts')],
      calls: [],
    })
    const chart = await buildChart([makeFile('z/foo.ts'), makeFile('a/bar.ts')])
    expect(chart.modules).toEqual(['a', 'z'])
  })
})
