import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRepoSnapshotFromGitHub } from './fetchRepoSnapshot.ts'
import type { RawClosedPullRequest, RawMergedPullRequest, RawRepositoryOverview } from './rawTypes.ts'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function mergedPrNode(number: number): RawMergedPullRequest {
  return {
    number,
    title: `PR #${number}`,
    url: `https://github.com/o/r/pull/${number}`,
    createdAt: '2024-01-01T00:00:00Z',
    mergedAt: '2024-01-02T00:00:00Z',
    baseRefName: 'main',
    headRefName: `pr-${number}`,
    additions: 1,
    deletions: 1,
    changedFiles: 1,
    author: { login: 'dev', avatarUrl: null },
    labels: { nodes: [] },
    commits: { totalCount: 1, nodes: [] },
  }
}

function closedPrNode(number: number): RawClosedPullRequest {
  return {
    number,
    title: `Closed PR #${number}`,
    url: `https://github.com/o/r/pull/${number}`,
    createdAt: '2024-01-01T00:00:00Z',
    closedAt: '2024-01-03T00:00:00Z',
    baseRefName: 'main',
    headRefName: `closed-pr-${number}`,
    author: { login: 'dev', avatarUrl: null },
    commits: { totalCount: 1, nodes: [] },
  }
}

function closedPageBody(nodes: RawClosedPullRequest[], hasNextPage = false, endCursor: string | null = null) {
  return {
    data: {
      repository: {
        pullRequests: { pageInfo: { hasNextPage, endCursor }, nodes },
      },
    },
  }
}

function buildOverviewBody(): {
  data: { repository: RawRepositoryOverview }
} {
  return {
    data: {
      repository: {
        name: 'repo',
        description: 'A repo',
        url: 'https://github.com/o/repo',
        stargazerCount: 10,
        forkCount: 2,
        createdAt: '2020-01-01T00:00:00Z',
        pushedAt: '2024-01-01T00:00:00Z',
        defaultBranchRef: { name: 'main', target: { history: { nodes: [] } } },
        licenseInfo: { name: 'MIT License' },
        languages: { edges: [{ size: 100, node: { name: 'TypeScript', color: '#3178c6' } }] },
        releases: {
          totalCount: 1,
          nodes: [
            {
              name: 'v1',
              tagName: 'v1',
              url: 'https://x/1',
              publishedAt: '2023-01-01T00:00:00Z',
              createdAt: '2023-01-01T00:00:00Z',
              tag: { target: { oid: 'release-commit-oid' } },
            },
          ],
        },
        tags: { nodes: [] },
        branches: { nodes: [{ name: 'main', target: { committedDate: '2024-01-01T00:00:00Z' } }] },
        openPRs: { nodes: [] },
        mergedPRs: {
          pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
          nodes: [mergedPrNode(1), mergedPrNode(2)],
        },
      },
    },
  }
}

const overviewBody = buildOverviewBody()

const mergedPageBody = {
  data: {
    repository: {
      pullRequests: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [mergedPrNode(3)],
      },
    },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRepoSnapshotFromGitHub', () => {
  it('paginates merged PRs, then fetches closed PRs as their own query, assembling a full snapshot', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(overviewBody))
      .mockResolvedValueOnce(jsonResponse(mergedPageBody))
      .mockResolvedValueOnce(jsonResponse(closedPageBody([closedPrNode(101)])))
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(snapshot.meta.name).toBe('repo')
    expect(snapshot.meta.license).toBe('MIT License')
    expect(snapshot.mergedPullRequests.map((pr) => pr.number)).toEqual([1, 2, 3])
    expect(snapshot.mergedPullRequests[0]).toMatchObject({ baseRefName: 'main', headRefName: 'pr-1' })
    expect(snapshot.releases).toEqual([
      { name: 'v1', tag: 'v1', date: '2023-01-01T00:00:00Z', url: 'https://x/1', targetOid: 'release-commit-oid' },
    ])
    expect(snapshot.liveBranches).toEqual([{ name: 'main', lastCommitDate: '2024-01-01T00:00:00Z' }])
    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([101])
    expect(snapshot.source).toBe('github')
    expect(new Date(snapshot.fetchedAt).toString()).not.toBe('Invalid Date')
  })

  it('paginates closed PRs across requests when a page has more', async () => {
    const body = structuredClone(overviewBody)
    body.data.repository.mergedPRs = { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(closedPageBody([closedPrNode(201)], true, 'closed-cursor-1')))
      .mockResolvedValueOnce(jsonResponse(closedPageBody([closedPrNode(202)])))
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([201, 202])
  })

  it('honestly returns no closed PRs (never fabricated) when even the first closed-PR page fails', async () => {
    const body = structuredClone(overviewBody)
    body.data.repository.mergedPRs = { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(snapshot.closedPullRequests).toEqual([])
    // The rest of the snapshot is unaffected by the closed-PR fetch failure.
    expect(snapshot.meta.name).toBe('repo')
  })

  it('honestly keeps only the closed PRs already fetched when a continuation page fails', async () => {
    const body = structuredClone(overviewBody)
    body.data.repository.mergedPRs = { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(closedPageBody([closedPrNode(301)], true, 'closed-cursor-1')))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([301])
  })

  it('falls back to tags when there are no releases', async () => {
    const bodyWithoutReleases = structuredClone(overviewBody)
    bodyWithoutReleases.data.repository.releases = { totalCount: 0, nodes: [] }
    bodyWithoutReleases.data.repository.tags = {
      nodes: [{ name: 'v0', target: { committedDate: '2022-01-01T00:00:00Z', url: 'https://x/tag/v0' } }],
    }
    bodyWithoutReleases.data.repository.mergedPRs = {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [],
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(bodyWithoutReleases))
        .mockResolvedValue(jsonResponse(closedPageBody([]))),
    )

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')
    expect(snapshot.releases).toEqual([
      { name: 'v0', tag: 'v0', date: '2022-01-01T00:00:00Z', url: 'https://x/tag/v0', targetOid: null },
    ])
  })

  it('throws RepoError("not_found") when the repository is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ data: { repository: null } }))),
    )
    await expect(fetchRepoSnapshotFromGitHub('o', 'missing', 'token')).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
