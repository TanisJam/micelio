import { describe, expect, it } from 'vitest'
import { validateRepoIdentity } from './validateRepoIdentity.ts'

describe('validateRepoIdentity', () => {
  it('accepts and trims valid owner/repo pairs', () => {
    expect(validateRepoIdentity(' pmndrs ', ' valtio ')).toEqual({ owner: 'pmndrs', repo: 'valtio' })
  })

  it('accepts repo names with dots, dashes and underscores', () => {
    expect(validateRepoIdentity('owner', 'my-repo.name_2')).toEqual({ owner: 'owner', repo: 'my-repo.name_2' })
  })

  it('rejects missing owner or repo', () => {
    expect(() => validateRepoIdentity('', 'repo')).toThrow(/required/)
    expect(() => validateRepoIdentity('owner', '')).toThrow(/required/)
    expect(() => validateRepoIdentity(undefined, undefined)).toThrow(/required/)
  })

  it('rejects an owner with invalid characters', () => {
    expect(() => validateRepoIdentity('owner/../etc', 'repo')).toThrow(/not a valid GitHub owner/)
  })

  it('rejects an owner starting or ending with a hyphen', () => {
    expect(() => validateRepoIdentity('-owner', 'repo')).toThrow(/not a valid GitHub owner/)
    expect(() => validateRepoIdentity('owner-', 'repo')).toThrow(/not a valid GitHub owner/)
  })

  it('rejects a repo with path traversal characters', () => {
    expect(() => validateRepoIdentity('owner', '../secret')).toThrow(/not a valid GitHub repository/)
  })

  it('every rejection is a RepoError with code "invalid_input"', () => {
    try {
      validateRepoIdentity('', '')
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ name: 'RepoError', code: 'invalid_input' })
    }
  })
})
