import { describe, expect, it } from 'vitest'
import { parseRepoInput } from './parseRepoInput'

describe('parseRepoInput', () => {
  it('accepts plain owner/repo', () => {
    expect(parseRepoInput('pmndrs/valtio')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseRepoInput('  pmndrs/valtio  ')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('accepts a full https URL', () => {
    expect(parseRepoInput('https://github.com/pmndrs/valtio')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('accepts a URL with no scheme and a www prefix', () => {
    expect(parseRepoInput('www.github.com/pmndrs/valtio')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
    expect(parseRepoInput('github.com/pmndrs/valtio')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('accepts a URL with a trailing path, query or hash (a deep link to a file/PR/commit)', () => {
    expect(parseRepoInput('https://github.com/pmndrs/valtio/pull/123')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
    expect(parseRepoInput('https://github.com/pmndrs/valtio/blob/main/README.md')).toEqual({
      owner: 'pmndrs',
      repo: 'valtio',
    })
    expect(parseRepoInput('https://github.com/pmndrs/valtio?tab=readme-ov-file')).toEqual({
      owner: 'pmndrs',
      repo: 'valtio',
    })
  })

  it('accepts a URL or plain form with a trailing .git', () => {
    expect(parseRepoInput('https://github.com/pmndrs/valtio.git')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
    expect(parseRepoInput('pmndrs/valtio.git')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('accepts a git@ SSH remote', () => {
    expect(parseRepoInput('git@github.com:pmndrs/valtio.git')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
    expect(parseRepoInput('git@github.com:pmndrs/valtio')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('returns null for empty or whitespace-only input', () => {
    expect(parseRepoInput('')).toBeNull()
    expect(parseRepoInput('   ')).toBeNull()
  })

  it('returns null for input with no owner/repo shape', () => {
    expect(parseRepoInput('just-a-word')).toBeNull()
    expect(parseRepoInput('https://example.com/pmndrs/valtio')).toBeNull()
  })

  it('returns null for an invalid owner or repo name (path traversal, bad characters)', () => {
    expect(parseRepoInput('../etc/passwd')).toBeNull()
    expect(parseRepoInput('https://github.com/-bad-owner/repo')).toBeNull()
  })

  it('never throws on malformed input', () => {
    expect(() => parseRepoInput('////')).not.toThrow()
    expect(() => parseRepoInput('git@github.com:')).not.toThrow()
  })
})
