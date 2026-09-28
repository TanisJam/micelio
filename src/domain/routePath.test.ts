import { describe, expect, it } from 'vitest'
import { buildRepoPath } from './routePath'

describe('buildRepoPath', () => {
  it('builds an /owner/repo path', () => {
    expect(buildRepoPath({ owner: 'pmndrs', repo: 'valtio' })).toBe('/pmndrs/valtio')
  })

  it('URL-encodes owner/repo segments', () => {
    expect(buildRepoPath({ owner: 'a b', repo: 'c/d' })).toBe('/a%20b/c%2Fd')
  })
})
