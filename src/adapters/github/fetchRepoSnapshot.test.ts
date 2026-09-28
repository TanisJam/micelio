import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRepoSnapshotFromGitHub } from './fetchRepoSnapshot.ts'
import type { RawMergedPullRequest, RawRepositoryOverview } from './rawTypes.ts'

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
    additions: 1,
    deletions: 1,
    changedFiles: 1,
    author: { login: 'dev', avatarUrl: null },
    labels: { nodes: [] },
    commits: { totalCount: 1, nodes: [] },
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

const pageBody = {
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
  it('paginates merged PRs across requests and assembles a full snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(overviewBody)).mockResolvedValueOnce(jsonResponse(pageBody))
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(snapshot.meta.name).toBe('repo')
    expect(snapshot.meta.license).toBe('MIT License')
    expect(snapshot.mergedPullRequests.map((pr) => pr.number)).toEqual([1, 2, 3])
    expect(snapshot.releases).toEqual([{ name: 'v1', tag: 'v1', date: '2023-01-01T00:00:00Z', url: 'https://x/1' }])
    expect(snapshot.liveBranches).toEqual([{ name: 'main', lastCommitDate: '2024-01-01T00:00:00Z' }])
    expect(snapshot.source).toBe('github')
    expect(new Date(snapshot.fetchedAt).toString()).not.toBe('Invalid Date')
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(bodyWithoutReleases)))

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')
    expect(snapshot.releases).toEqual([{ name: 'v0', tag: 'v0', date: '2022-01-01T00:00:00Z', url: 'https://x/tag/v0' }])
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
