import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAPS } from './caps.ts'
import { fetchRepoSnapshotFromGitHub } from './fetchRepoSnapshot.ts'
import { CLOSED_PRS_PAGE_QUERY, DIRECT_COMMITS_PAGE_QUERY, MERGED_PRS_PAGE_QUERY, REPO_META_QUERY } from './queries.ts'
import type { RawClosedPullRequest, RawHistoryCommit, RawMergedPullRequest, RawRepositoryMeta } from './rawTypes.ts'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function queryOf(init: { body: string }): string {
  return (JSON.parse(init.body) as { query: string }).query
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

function directCommitNode(oid: string, overrides: Partial<RawHistoryCommit> = {}): RawHistoryCommit {
  return {
    oid,
    messageHeadline: `commit ${oid}`,
    authoredDate: '2024-01-01T00:00:00Z',
    url: `https://github.com/o/r/commit/${oid}`,
    author: { name: 'Dev', user: { login: 'dev', avatarUrl: null } },
    associatedPullRequests: { totalCount: 0 },
    additions: 2,
    deletions: 1,
    ...overrides,
  }
}

function mergedPageBody(nodes: RawMergedPullRequest[], hasNextPage = false, endCursor: string | null = null, totalCount = nodes.length) {
  return { data: { repository: { pullRequests: { totalCount, pageInfo: { hasNextPage, endCursor }, nodes } } } }
}

function closedPageBody(nodes: RawClosedPullRequest[], hasNextPage = false, endCursor: string | null = null, totalCount = nodes.length) {
  return { data: { repository: { pullRequests: { totalCount, pageInfo: { hasNextPage, endCursor }, nodes } } } }
}

function directPageBody(nodes: RawHistoryCommit[], hasNextPage = false, endCursor: string | null = null, totalCount = nodes.length) {
  return {
    data: { repository: { defaultBranchRef: { target: { history: { totalCount, pageInfo: { hasNextPage, endCursor }, nodes } } } } },
  }
}

function buildMetaBody(): { data: { repository: RawRepositoryMeta } } {
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
        defaultBranchRef: { name: 'main' },
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
      },
    },
  }
}

/**
 * A single fetch mock covering all four of `fetchRepoSnapshotFromGitHub`'s
 * concurrent requests (meta, merged-PR pages, closed-PR pages, direct-
 * commit-history pages). Dispatches on the posted GraphQL query string
 * itself, never assumed call order -- the four streams start together and
 * run fully concurrently (Unit 1/2), so nothing about their real
 * interleaving should matter to correctness.
 */
function routedFetch(handlers: {
  meta?: () => Response
  merged?: () => Response
  closed?: () => Response
  direct?: () => Response
}): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    // A real microtask yield, so all four concurrent streams' fetch calls
    // actually get DISPATCHED (their own pagination loop's pre-fetch budget
    // check already ran) before any one stream's handler body runs -- this
    // makes the mock behave like real concurrent network requests instead
    // of one stream's handler (e.g. one that advances the fake clock)
    // running to completion before a sibling stream has even been reached.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const query = queryOf(init)
    if (query === REPO_META_QUERY) return (handlers.meta ?? (() => jsonResponse(buildMetaBody())))()
    if (query === MERGED_PRS_PAGE_QUERY) return (handlers.merged ?? (() => jsonResponse(mergedPageBody([]))))()
    if (query === CLOSED_PRS_PAGE_QUERY) return (handlers.closed ?? (() => jsonResponse(closedPageBody([]))))()
    if (query === DIRECT_COMMITS_PAGE_QUERY) return (handlers.direct ?? (() => jsonResponse(directPageBody([]))))()
    throw new Error(`unexpected GraphQL query: ${query}`)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchRepoSnapshotFromGitHub', () => {
  it('fetches meta, merged and closed PRs concurrently and assembles a full snapshot', async () => {
    const fetchMock = routedFetch({
      merged: (() => {
        let call = 0
        return () => {
          call += 1
          if (call === 1) return jsonResponse(mergedPageBody([mergedPrNode(1), mergedPrNode(2)], true, 'm1', 3))
          return jsonResponse(mergedPageBody([mergedPrNode(3)], false, null, 3))
        }
      })(),
      closed: () => jsonResponse(closedPageBody([closedPrNode(101)])),
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(5) // meta + 2 merged pages + 1 closed page + 1 direct-commit page
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
    expect(snapshot.truncated).toBeUndefined()
    expect(new Date(snapshot.fetchedAt).toString()).not.toBe('Invalid Date')
  })

  it('paginates closed PRs across requests when a page has more', async () => {
    let call = 0
    const fetchMock = routedFetch({
      closed: () => {
        call += 1
        if (call === 1) return jsonResponse(closedPageBody([closedPrNode(201)], true, 'closed-cursor-1', 2))
        return jsonResponse(closedPageBody([closedPrNode(202)], false, null, 2))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([201, 202])
    expect(snapshot.truncated).toBeUndefined()
  })

  it('honestly returns no closed PRs (never fabricated) and flags it when even the first closed-PR page fails', async () => {
    const fetchMock = routedFetch({
      closed: () => new Response('boom', { status: 500 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.closedPullRequests).toEqual([])
    expect(snapshot.truncated?.closedPullRequests).toEqual({ fetched: 0, totalCount: null, reason: 'error' })
    // The rest of the snapshot is unaffected by the closed-PR fetch failure.
    expect(snapshot.meta.name).toBe('repo')
    expect(snapshot.truncated?.mergedPullRequests).toBeUndefined()
  })

  it('honestly keeps only the closed PRs already fetched (partial + flagged) when a continuation page fails', async () => {
    let call = 0
    const fetchMock = routedFetch({
      closed: () => {
        call += 1
        if (call === 1) return jsonResponse(closedPageBody([closedPrNode(301)], true, 'closed-cursor-1', 5))
        return new Response('boom', { status: 500 })
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([301])
    expect(snapshot.truncated?.closedPullRequests).toEqual({ fetched: 1, totalCount: 5, reason: 'error' })
  })

  it('honestly returns no merged PRs (never fabricated) and flags it when even the first merged-PR page fails', async () => {
    const fetchMock = routedFetch({
      merged: () => new Response('boom', { status: 500 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.mergedPullRequests).toEqual([])
    expect(snapshot.truncated?.mergedPullRequests).toEqual({ fetched: 0, totalCount: null, reason: 'error' })
    // A merged-PR fetch failure doesn't lose the rest of the snapshot either.
    expect(snapshot.meta.name).toBe('repo')
    expect(snapshot.truncated?.closedPullRequests).toBeUndefined()
  })

  it('honestly keeps only the merged PRs already fetched (partial + flagged) when a continuation page fails', async () => {
    let call = 0
    const fetchMock = routedFetch({
      merged: () => {
        call += 1
        if (call === 1) return jsonResponse(mergedPageBody([mergedPrNode(1)], true, 'merged-cursor-1', 9))
        return new Response('boom', { status: 500 })
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.mergedPullRequests.map((pr) => pr.number)).toEqual([1])
    expect(snapshot.truncated?.mergedPullRequests).toEqual({ fetched: 1, totalCount: 9, reason: 'error' })
  })

  it('fetches and maps direct (non-PR) commits, excluding any commit associated with a pull request', async () => {
    const fetchMock = routedFetch({
      direct: () =>
        jsonResponse(
          directPageBody([
            directCommitNode('direct-1', { associatedPullRequests: { totalCount: 0 } }),
            directCommitNode('pr-commit-1', { associatedPullRequests: { totalCount: 1 } }),
            directCommitNode('direct-2', { associatedPullRequests: { totalCount: 0 }, additions: 5, deletions: 2 }),
          ]),
        ),
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.directCommits.map((c) => c.oid)).toEqual(['direct-1', 'direct-2'])
    expect(snapshot.directCommits[1]).toMatchObject({ additions: 5, deletions: 2 })
    expect(snapshot.truncated?.directCommits).toBeUndefined()
  })

  it('paginates direct-commit history across requests when a page has more', async () => {
    let call = 0
    const fetchMock = routedFetch({
      direct: () => {
        call += 1
        if (call === 1) return jsonResponse(directPageBody([directCommitNode('d1')], true, 'direct-cursor-1', 2))
        return jsonResponse(directPageBody([directCommitNode('d2')], false, null, 2))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.directCommits.map((c) => c.oid)).toEqual(['d1', 'd2'])
    expect(snapshot.truncated?.directCommits).toBeUndefined()
  })

  it('honestly keeps only the direct commits already fetched (partial + flagged) when a continuation page fails', async () => {
    let call = 0
    const fetchMock = routedFetch({
      direct: () => {
        call += 1
        if (call === 1) return jsonResponse(directPageBody([directCommitNode('d1')], true, 'direct-cursor-1', 5))
        return new Response('boom', { status: 500 })
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(snapshot.directCommits.map((c) => c.oid)).toEqual(['d1'])
    expect(snapshot.truncated?.directCommits).toEqual({ fetched: 1, totalCount: 5, reason: 'error' })
    // The other two independent streams are unaffected.
    expect(snapshot.truncated?.mergedPullRequests).toBeUndefined()
    expect(snapshot.truncated?.closedPullRequests).toBeUndefined()
  })

  it('stops direct-commit-history pagination once the global time budget is exceeded, returning a partial + flagged snapshot', async () => {
    vi.useFakeTimers()
    const fetchMock = routedFetch({
      direct: () => {
        vi.advanceTimersByTime(CAPS.fetchTimeBudgetMs + 1000)
        return jsonResponse(directPageBody([directCommitNode('d1')], true, 'direct-cursor-1', 500))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    const directCalls = fetchMock.mock.calls.filter(([, init]) => queryOf(init) === DIRECT_COMMITS_PAGE_QUERY)
    expect(directCalls).toHaveLength(1)
    expect(snapshot.directCommits.map((c) => c.oid)).toEqual(['d1'])
    expect(snapshot.truncated?.directCommits).toEqual({ fetched: 1, totalCount: 500, reason: 'time_budget' })
  })

  /**
   * Post-final-pass Unit 1 (cold-fetch regression): the shared deadline
   * must bound the WHOLE fetch, not just the gap between pages -- a page
   * that's already in flight when the deadline hits must be cut off too,
   * across every concurrent stream (meta, merged/closed PRs, direct
   * commits) alike. Unlike the pre-existing "time budget" tests above
   * (which simulate a slow page by advancing the fake clock synchronously
   * INSIDE the mocked handler before it resolves), this simulates a page
   * that never resolves on its own at all -- only the deadline-driven abort
   * (`graphqlClient.ts`'s `deadlineAt`) can end it.
   */
  it('aborts a still-in-flight page once the global deadline passes, honoring one shared deadline across every concurrent stream', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: { body: string; signal?: AbortSignal }) => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      const query = queryOf(init)
      if (query === REPO_META_QUERY) return jsonResponse(buildMetaBody())
      if (query === CLOSED_PRS_PAGE_QUERY) return jsonResponse(closedPageBody([]))
      if (query === DIRECT_COMMITS_PAGE_QUERY) return jsonResponse(directPageBody([]))
      if (query === MERGED_PRS_PAGE_QUERY) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
        })
      }
      throw new Error(`unexpected GraphQL query: ${query}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const pending = fetchRepoSnapshotFromGitHub('o', 'repo', 'token')
    await vi.advanceTimersByTimeAsync(CAPS.fetchTimeBudgetMs)
    const snapshot = await pending

    expect(snapshot.mergedPullRequests).toEqual([])
    expect(snapshot.truncated?.mergedPullRequests).toEqual({ fetched: 0, totalCount: null, reason: 'time_budget' })
    // The other, unblocked streams complete normally and are unaffected.
    expect(snapshot.truncated?.closedPullRequests).toBeUndefined()
    expect(snapshot.truncated?.directCommits).toBeUndefined()
    expect(snapshot.meta.name).toBe('repo')
  })

  it('falls back to tags when there are no releases', async () => {
    const fetchMock = routedFetch({
      meta: () => {
        const body = buildMetaBody()
        body.data.repository.releases = { totalCount: 0, nodes: [] }
        body.data.repository.tags = {
          nodes: [{ name: 'v0', target: { committedDate: '2022-01-01T00:00:00Z', url: 'https://x/tag/v0' } }],
        }
        return jsonResponse(body)
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')
    expect(snapshot.releases).toEqual([
      { name: 'v0', tag: 'v0', date: '2022-01-01T00:00:00Z', url: 'https://x/tag/v0', targetOid: null },
    ])
  })

  /**
   * C3/T8 (extended by Unit 1 to three streams): meta, merged-PR and
   * closed-PR fetching all run concurrently. This test deliberately does
   * NOT assume any particular interleaving -- it dispatches on the posted
   * GraphQL query string, each stream keeping its own page counter. That's
   * the actual property that matters: concurrency must never corrupt either
   * PR stream's own cursor-following sequence or merge results out of
   * order, regardless of exactly how the streams interleave in a real event
   * loop.
   */
  it('paginates merged and closed PRs correctly when running concurrently, across multiple pages each', async () => {
    const mergedPages = [
      { nodes: [mergedPrNode(1), mergedPrNode(2)], hasNextPage: true, endCursor: 'merged-cursor-1' },
      { nodes: [mergedPrNode(3)], hasNextPage: true, endCursor: 'merged-cursor-2' },
      { nodes: [mergedPrNode(4)], hasNextPage: false, endCursor: null },
    ]
    const closedPages = [
      { nodes: [closedPrNode(101)], hasNextPage: true, endCursor: 'closed-cursor-1' },
      { nodes: [closedPrNode(102)], hasNextPage: false, endCursor: null },
    ]
    let mergedCallIndex = 0
    let closedCallIndex = 0

    const fetchMock = routedFetch({
      merged: () => {
        const page = mergedPages[mergedCallIndex++]!
        return jsonResponse(mergedPageBody(page.nodes, page.hasNextPage, page.endCursor, 4))
      },
      closed: () => {
        const page = closedPages[closedCallIndex++]!
        return jsonResponse(closedPageBody(page.nodes, page.hasNextPage, page.endCursor, 2))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    expect(fetchMock).toHaveBeenCalledTimes(7) // meta + 3 merged pages + 2 closed pages + 1 direct-commit page
    expect(snapshot.mergedPullRequests.map((pr) => pr.number)).toEqual([1, 2, 3, 4])
    expect(snapshot.closedPullRequests.map((pr) => pr.number)).toEqual([101, 102])
    expect(snapshot.truncated).toBeUndefined()
  })

  it('stops merged-PR pagination once the global time budget is exceeded, returning a partial + flagged snapshot', async () => {
    vi.useFakeTimers()
    const fetchMock = routedFetch({
      merged: () => {
        // Simulate this page's own round trip alone taking longer than the
        // whole fetch budget -- the loop must check the budget BEFORE
        // asking for a next page, so it should never issue a second request
        // here even though this page honestly reports `hasNextPage: true`.
        vi.advanceTimersByTime(CAPS.fetchTimeBudgetMs + 1000)
        return jsonResponse(mergedPageBody([mergedPrNode(1)], true, 'merged-cursor-1', 500))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchRepoSnapshotFromGitHub('o', 'repo', 'token')

    const mergedCalls = fetchMock.mock.calls.filter(([, init]) => queryOf(init) === MERGED_PRS_PAGE_QUERY)
    expect(mergedCalls).toHaveLength(1)
    expect(snapshot.mergedPullRequests.map((pr) => pr.number)).toEqual([1])
    expect(snapshot.truncated?.mergedPullRequests).toEqual({ fetched: 1, totalCount: 500, reason: 'time_budget' })
    // The independent closed-PR stream (a single, fast, `hasNextPage: false`
    // page here) is unaffected by merged PRs' own budget cutoff.
    expect(snapshot.truncated?.closedPullRequests).toBeUndefined()
  })

  it('throws RepoError("not_found") when the repository is null', async () => {
    const fetchMock = routedFetch({
      meta: () => jsonResponse({ data: { repository: null } }),
      merged: () => jsonResponse({ data: { repository: null } }),
      closed: () => jsonResponse({ data: { repository: null } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchRepoSnapshotFromGitHub('o', 'missing', 'token')).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
