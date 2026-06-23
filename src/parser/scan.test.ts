import { describe, it, expect } from 'vitest'
import { SKIP_DIRS, MAX_FILES, MAX_FILE_BYTES } from './scan'
import { langForPath, SUPPORTED_LANGS_LABEL } from './languages'

describe('SKIP_DIRS', () => {
  it('includes common directories to skip', () => {
    expect(SKIP_DIRS.has('node_modules')).toBe(true)
    expect(SKIP_DIRS.has('.git')).toBe(true)
    expect(SKIP_DIRS.has('dist')).toBe(true)
    expect(SKIP_DIRS.has('coverage')).toBe(true)
  })
})

describe('MAX_FILES', () => {
  it('is set to a reasonable limit', () => {
    expect(MAX_FILES).toBe(4000)
  })
})

describe('MAX_FILE_BYTES', () => {
  it('is set to a reasonable limit', () => {
    expect(MAX_FILE_BYTES).toBe(1_500_000)
  })
})

describe('langForPath', () => {
  it('returns typescript for .ts files', () => {
    expect(langForPath('foo.ts')).toBe('typescript')
  })

  it('returns tsx for .tsx files', () => {
    expect(langForPath('foo.tsx')).toBe('tsx')
  })

  it('returns javascript for .js files', () => {
    expect(langForPath('foo.js')).toBe('javascript')
  })

  it('returns python for .py files', () => {
    expect(langForPath('foo.py')).toBe('python')
  })

  it('returns go for .go files', () => {
    expect(langForPath('foo.go')).toBe('go')
  })

  it('returns rust for .rs files', () => {
    expect(langForPath('foo.rs')).toBe('rust')
  })

  it('returns java for .java files', () => {
    expect(langForPath('foo.java')).toBe('java')
  })

  it('returns c for .c files', () => {
    expect(langForPath('foo.c')).toBe('c')
  })

  it('returns cpp for .cpp files', () => {
    expect(langForPath('foo.cpp')).toBe('cpp')
  })

  it('returns cpp for .hpp files', () => {
    expect(langForPath('foo.hpp')).toBe('cpp')
  })

  it('returns null for .d.ts files', () => {
    expect(langForPath('foo.d.ts')).toBeNull()
  })

  it('returns null for unknown extensions', () => {
    expect(langForPath('foo.txt')).toBeNull()
    expect(langForPath('foo')).toBeNull()
  })

  it('handles uppercase extensions', () => {
    expect(langForPath('foo.TS')).toBe('typescript')
    expect(langForPath('foo.PY')).toBe('python')
  })

  it('handles special extensions like .mts and .cts', () => {
    expect(langForPath('foo.mts')).toBe('typescript')
    expect(langForPath('foo.cts')).toBe('typescript')
  })

  it('handles .jsx and .mjs', () => {
    expect(langForPath('foo.jsx')).toBe('javascript')
    expect(langForPath('foo.mjs')).toBe('javascript')
  })

  it('handles C++ extensions', () => {
    expect(langForPath('foo.cc')).toBe('cpp')
    expect(langForPath('foo.cxx')).toBe('cpp')
    expect(langForPath('foo.hh')).toBe('cpp')
    expect(langForPath('foo.h')).toBe('cpp')
  })
})

describe('SUPPORTED_LANGS_LABEL', () => {
  it('lists all supported languages', () => {
    expect(SUPPORTED_LANGS_LABEL).toContain('TypeScript')
    expect(SUPPORTED_LANGS_LABEL).toContain('JavaScript')
    expect(SUPPORTED_LANGS_LABEL).toContain('Python')
    expect(SUPPORTED_LANGS_LABEL).toContain('Go')
    expect(SUPPORTED_LANGS_LABEL).toContain('Rust')
    expect(SUPPORTED_LANGS_LABEL).toContain('Java')
    expect(SUPPORTED_LANGS_LABEL).toContain('C')
    expect(SUPPORTED_LANGS_LABEL).toContain('C++')
  })
})