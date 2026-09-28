import { describe, expect, it } from 'vitest'
import type { HyphaDraft } from './topology'
import { authorKeyOf, buildAuthorHueIndex, MAX_AUTHOR_HUES, resolveAuthorHueKey } from './sectors'

function stubDraft(overrides: Partial<HyphaDraft>): HyphaDraft {
  return {
    id: 'hypha-x',
    kind: 'merged',
    ref: { type: 'pull_request', id: '1' },
    parentHyphaId: 'hypha-main',
    rawSplitTime: 0,
    splitTime: 0,
    endTime: 100,
    status: 'fused',
    title: 'x',
    url: 'https://x',
    author: { login: null, avatarUrl: null },
    commitCount: 1,
    workLines: null,
    commits: [],
    ...overrides,
  }
}

describe('buildAuthorHueIndex', () => {
  it('ranks contributors by merged-PR count, most first', () => {
    const hyphae: HyphaDraft[] = [
      ...Array.from({ length: 5 }, (_, i) => stubDraft({ id: `a${i}`, author: { login: 'alice', avatarUrl: null }, splitTime: i * 1000, kind: 'merged' })),
      ...Array.from({ length: 2 }, (_, i) => stubDraft({ id: `b${i}`, author: { login: 'bob', avatarUrl: null }, splitTime: 500 + i * 1000, kind: 'merged' })),
    ]
    const index = buildAuthorHueIndex(hyphae)
    expect(index.get('alice')).toBe(0)
    expect(index.get('bob')).toBe(1)
  })

  it('always reserves a community index, even for a zero-merged-PR-only population', () => {
    const hyphae: HyphaDraft[] = [stubDraft({ id: 'c1', author: { login: 'casual', avatarUrl: null }, splitTime: 500, kind: 'closed' })]
    const index = buildAuthorHueIndex(hyphae)
    expect(index.has('casual')).toBe(false)
    expect(index.get('community')).toBe(MAX_AUTHOR_HUES)
  })

  it('caps individual indices at MAX_AUTHOR_HUES, pushing the long tail to community', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: MAX_AUTHOR_HUES + 10 }, (_, i) =>
      stubDraft({ id: `pr${i}`, author: { login: `author${i}`, avatarUrl: null }, splitTime: i * 1000, kind: 'merged' }),
    )
    const index = buildAuthorHueIndex(hyphae)
    const individualIndices = [...index.entries()].filter(([key]) => key !== 'community')
    expect(individualIndices).toHaveLength(MAX_AUTHOR_HUES)
    for (const [, value] of individualIndices) expect(value).toBeLessThan(MAX_AUTHOR_HUES)
    expect(index.get('community')).toBe(MAX_AUTHOR_HUES)
  })

  it('is deterministic', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: 20 }, (_, i) =>
      stubDraft({ id: `pr${i}`, author: { login: i % 4 === 0 ? null : `author${i % 5}`, avatarUrl: null }, splitTime: i * 1000, kind: 'merged' }),
    )
    const a = buildAuthorHueIndex(hyphae)
    const b = buildAuthorHueIndex(hyphae)
    expect([...a.entries()]).toEqual([...b.entries()])
  })

  it('falls back to just the community index for an empty hypha list', () => {
    const index = buildAuthorHueIndex([])
    expect(index.size).toBe(1)
    expect(index.get('community')).toBe(MAX_AUTHOR_HUES)
  })
})

describe('authorKeyOf / resolveAuthorHueKey', () => {
  it('maps a null login to the community key', () => {
    expect(authorKeyOf(null)).toBe('community')
    expect(authorKeyOf('alice')).toBe('alice')
  })

  it('resolves an unlisted author to community', () => {
    const index = buildAuthorHueIndex([stubDraft({ author: { login: 'alice', avatarUrl: null } })])
    expect(resolveAuthorHueKey('someone-else', index)).toBe('community')
    expect(resolveAuthorHueKey('alice', index)).toBe('alice')
  })
})
