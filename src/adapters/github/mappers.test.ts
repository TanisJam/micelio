import { describe, expect, it } from 'vitest'
import {
  mapActor,
  mapBranches,
  mapCommit,
  mapDirectCommits,
  mapGitActor,
  mapLanguages,
  mapMergedPullRequest,
  mapOpenPullRequest,
  mapReleases,
  mapTagsAsReleases,
} from './mappers.ts'
import type {
  RawBranchRef,
  RawHistoryCommit,
  RawLanguageEdge,
  RawMergedPullRequest,
  RawOpenPullRequest,
  RawRelease,
  RawTagRef,
} from './rawTypes.ts'

describe('mapActor', () => {
  it('maps a GitHub user actor', () => {
    expect(mapActor({ login: 'octocat', avatarUrl: 'https://example.com/a.png' })).toEqual({
      login: 'octocat',
      avatarUrl: 'https://example.com/a.png',
    })
  })

  it('handles a missing actor (e.g. deleted account)', () => {
    expect(mapActor(null)).toEqual({ login: null, avatarUrl: null })
    expect(mapActor(undefined)).toEqual({ login: null, avatarUrl: null })
  })
})

describe('mapGitActor', () => {
  it('prefers the linked GitHub user over the raw git author name', () => {
    expect(
      mapGitActor({ name: 'Jane Doe', user: { login: 'janedoe', avatarUrl: 'https://example.com/j.png' } }),
    ).toEqual({ login: 'janedoe', avatarUrl: 'https://example.com/j.png' })
  })

  it('returns nulls when there is no linked GitHub user', () => {
    expect(mapGitActor({ name: 'Jane Doe', user: null })).toEqual({ login: null, avatarUrl: null })
    expect(mapGitActor(null)).toEqual({ login: null, avatarUrl: null })
  })
})

describe('mapCommit', () => {
  it('maps a raw commit to a PrCommit', () => {
    const raw = {
      oid: 'abc123',
      messageHeadline: 'fix: a thing',
      authoredDate: '2024-01-01T00:00:00Z',
      url: 'https://github.com/o/r/commit/abc123',
      author: { name: 'Jane Doe', user: { login: 'janedoe', avatarUrl: 'https://x/y.png' } },
    }
    expect(mapCommit(raw)).toEqual({
      oid: 'abc123',
      messageHeadline: 'fix: a thing',
      authoredDate: '2024-01-01T00:00:00Z',
      url: 'https://github.com/o/r/commit/abc123',
      author: { login: 'janedoe', avatarUrl: 'https://x/y.png' },
    })
  })
})

function buildRawMergedPr(overrides: Partial<RawMergedPullRequest> = {}): RawMergedPullRequest {
  return {
    number: 42,
    title: 'feat: add thing',
    url: 'https://github.com/o/r/pull/42',
    createdAt: '2024-01-01T00:00:00Z',
    mergedAt: '2024-01-02T00:00:00Z',
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    author: { login: 'janedoe', avatarUrl: 'https://x/y.png' },
    labels: { nodes: [{ name: 'feature' }] },
    commits: {
      totalCount: 1,
      nodes: [
        {
          commit: {
            oid: 'abc123',
            messageHeadline: 'feat: add thing',
            authoredDate: '2024-01-01T00:00:00Z',
            url: 'https://github.com/o/r/commit/abc123',
            author: { name: 'Jane Doe', user: { login: 'janedoe', avatarUrl: 'https://x/y.png' } },
          },
        },
      ],
    },
    ...overrides,
  }
}

describe('mapMergedPullRequest', () => {
  it('maps every field, keeping the true commit count alongside the capped list', () => {
    const raw = buildRawMergedPr({ commits: { totalCount: 45, nodes: buildRawMergedPr().commits.nodes } })
    const mapped = mapMergedPullRequest(raw)
    expect(mapped.number).toBe(42)
    expect(mapped.labels).toEqual(['feature'])
    expect(mapped.commitCount).toBe(45)
    expect(mapped.commits).toHaveLength(1)
  })

  it('caps the commits list even if the raw payload has more than the cap', () => {
    const manyCommits = Array.from({ length: 25 }, (_, i) => ({
      commit: {
        oid: `oid-${i}`,
        messageHeadline: `commit ${i}`,
        authoredDate: '2024-01-01T00:00:00Z',
        url: `https://github.com/o/r/commit/oid-${i}`,
        author: null,
      },
    }))
    const raw = buildRawMergedPr({ commits: { totalCount: 25, nodes: manyCommits } })
    const mapped = mapMergedPullRequest(raw)
    expect(mapped.commits).toHaveLength(20)
    expect(mapped.commitCount).toBe(25)
  })
})

describe('mapOpenPullRequest', () => {
  it('maps a raw open PR', () => {
    const raw: RawOpenPullRequest = {
      number: 7,
      title: 'wip: exploring',
      url: 'https://github.com/o/r/pull/7',
      createdAt: '2024-02-01T00:00:00Z',
      author: { login: 'someone', avatarUrl: null },
    }
    expect(mapOpenPullRequest(raw)).toEqual({
      number: 7,
      title: 'wip: exploring',
      url: 'https://github.com/o/r/pull/7',
      createdAt: '2024-02-01T00:00:00Z',
      author: { login: 'someone', avatarUrl: null },
    })
  })
})

describe('mapLanguages', () => {
  it('maps language edges to shares', () => {
    const edges: RawLanguageEdge[] = [
      { size: 100, node: { name: 'TypeScript', color: '#3178c6' } },
      { size: 10, node: { name: 'CSS', color: null } },
    ]
    expect(mapLanguages(edges)).toEqual([
      { name: 'TypeScript', color: '#3178c6', bytes: 100 },
      { name: 'CSS', color: null, bytes: 10 },
    ])
  })

  it('returns an empty array when languages are missing', () => {
    expect(mapLanguages(undefined)).toEqual([])
  })
})

describe('mapReleases', () => {
  it('prefers the release name, falling back to the tag name', () => {
    const raw: RawRelease[] = [
      { name: 'v1.0', tagName: 'v1.0.0', url: 'https://x/1', publishedAt: '2024-01-01T00:00:00Z', createdAt: '2023-12-31T00:00:00Z' },
      { name: null, tagName: 'v0.9.0', url: 'https://x/0', publishedAt: null, createdAt: '2023-01-01T00:00:00Z' },
    ]
    expect(mapReleases(raw)).toEqual([
      { name: 'v1.0', tag: 'v1.0.0', date: '2024-01-01T00:00:00Z', url: 'https://x/1' },
      { name: 'v0.9.0', tag: 'v0.9.0', date: '2023-01-01T00:00:00Z', url: 'https://x/0' },
    ])
  })
})

describe('mapTagsAsReleases', () => {
  it('maps lightweight tags (direct commit target)', () => {
    const raw: RawTagRef[] = [
      { name: 'v1.0.0', target: { committedDate: '2024-01-01T00:00:00Z', url: 'https://x/commit/1' } },
    ]
    expect(mapTagsAsReleases(raw)).toEqual([
      { name: 'v1.0.0', tag: 'v1.0.0', date: '2024-01-01T00:00:00Z', url: 'https://x/commit/1' },
    ])
  })

  it('maps annotated tags (Tag object wrapping a commit)', () => {
    const raw: RawTagRef[] = [
      {
        name: 'v2.0.0',
        target: {
          tagger: { date: '2024-02-01T00:00:00Z' },
          target: { committedDate: '2024-01-30T00:00:00Z', url: 'https://x/commit/2' },
        },
      },
    ]
    expect(mapTagsAsReleases(raw)).toEqual([
      { name: 'v2.0.0', tag: 'v2.0.0', date: '2024-02-01T00:00:00Z', url: 'https://x/commit/2' },
    ])
  })

  it('skips tags with no usable target', () => {
    const raw: RawTagRef[] = [{ name: 'broken', target: null }]
    expect(mapTagsAsReleases(raw)).toEqual([])
  })
})

describe('mapBranches', () => {
  it('maps branches with a commit target and skips ones without', () => {
    const raw: RawBranchRef[] = [
      { name: 'main', target: { committedDate: '2024-01-01T00:00:00Z' } },
      { name: 'orphan', target: null },
    ]
    expect(mapBranches(raw)).toEqual([{ name: 'main', lastCommitDate: '2024-01-01T00:00:00Z' }])
  })
})

describe('mapDirectCommits', () => {
  it('keeps only commits with no associated pull request, capped', () => {
    const history: RawHistoryCommit[] = Array.from({ length: 30 }, (_, i) => ({
      oid: `oid-${i}`,
      messageHeadline: `commit ${i}`,
      authoredDate: '2024-01-01T00:00:00Z',
      url: `https://x/${i}`,
      author: null,
      associatedPullRequests: { totalCount: i % 2 === 0 ? 0 : 1 },
    }))
    const direct = mapDirectCommits(history)
    // Only even-indexed commits (totalCount 0) qualify; 15 exist, cap is 20.
    expect(direct).toHaveLength(15)
    expect(direct.map((c) => c.oid)).toEqual(['oid-0', 'oid-2', 'oid-4', 'oid-6', 'oid-8', 'oid-10', 'oid-12', 'oid-14', 'oid-16', 'oid-18', 'oid-20', 'oid-22', 'oid-24', 'oid-26', 'oid-28'])
  })

  it('caps direct commits even when more than the cap qualify', () => {
    const history: RawHistoryCommit[] = Array.from({ length: 60 }, (_, i) => ({
      oid: `oid-${i}`,
      messageHeadline: `commit ${i}`,
      authoredDate: '2024-01-01T00:00:00Z',
      url: `https://x/${i}`,
      author: null,
      associatedPullRequests: { totalCount: 0 },
    }))
    expect(mapDirectCommits(history)).toHaveLength(20)
  })
})
