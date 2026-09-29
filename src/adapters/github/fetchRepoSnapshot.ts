import { RepoError } from '../../domain/errors.ts'
import type { ClosedPullRequest, FetchTruncation, MergedPullRequest, PaginationTruncation, RepoSnapshot } from '../../domain/repo.ts'
import { CAPS } from './caps.ts'
import { graphqlRequest } from './graphqlClient.ts'
import {
  mapBranches,
  mapClosedPullRequest,
  mapDirectCommits,
  mapLanguages,
  mapMergedPullRequest,
  mapOpenPullRequest,
  mapReleases,
  mapTagsAsReleases,
} from './mappers.ts'
import { CLOSED_PRS_PAGE_QUERY, MERGED_PRS_PAGE_QUERY, REPO_META_QUERY } from './queries.ts'
import type {
  ClosedPrsPageResponse,
  MergedPrsPageResponse,
  RawClosedPullRequest,
  RawMergedPullRequest,
  RepoMetaResponse,
} from './rawTypes.ts'

interface RawPage<TRaw> {
  totalCount: number
  hasNextPage: boolean
  endCursor: string | null
  nodes: TRaw[]
}

interface PaginationResult<TMapped> {
  items: TMapped[]
  /** Set when the loop stopped before exhausting `hasNextPage` -- either the time budget or a request failure. `null` when the full (capped) list was fetched normally. */
  truncation: PaginationTruncation | null
}

/**
 * Unit 1 (cold-fetch time budget): a generic cursor-following pagination
 * loop shared by merged- and closed-PR fetching. Before this refactor,
 * merged PRs uniquely continued from the shared overview query's own first
 * page while closed PRs ran as their own from-scratch loop (C3/T8); both
 * are now fully independent, identically-shaped loops so they can run
 * concurrently with each other AND with the (now much cheaper) meta query
 * instead of merged-PR pagination being gated behind the meta query's own
 * latency.
 *
 * Stop conditions, checked in order, each honestly flagged on the result:
 * 1. `cap` items collected (unchanged pre-Unit-1 caps, e.g. `maxMergedPrs`).
 * 2. The global wall-clock budget (`CAPS.fetchTimeBudgetMs`, measured from
 *    the very start of the whole snapshot fetch) is exceeded -- checked
 *    BEFORE requesting the next page, never mid-request, so one slow page
 *    can only push total latency past the budget by that one page's own
 *    round-trip time, not by an unbounded amount. `reason: 'time_budget'`.
 * 3. A page request throws -- including the very first page -- in which
 *    case whatever pages already succeeded (possibly none) are kept rather
 *    than losing the whole snapshot (the closed-PR loop's existing C3/T8
 *    tolerance, now shared by merged PRs too, since the two loops are
 *    symmetric and a transient failure in one must never cost the other).
 *    `reason: 'error'`.
 *
 * Ordering is always most-recent-first (`ORDER BY ... DESC`, see
 * `queries.ts`), so a truncated result is always honestly "the N most
 * recent", never a fabricated or reordered subset.
 */
async function paginate<TRaw, TMapped>(params: {
  fetchStartedAt: number
  fetchTimeBudgetMs: number
  cap: number
  map: (raw: TRaw) => TMapped
  fetchPage: (after: string | null) => Promise<RawPage<TRaw> | null>
}): Promise<PaginationResult<TMapped>> {
  const { fetchStartedAt, fetchTimeBudgetMs, cap, map, fetchPage } = params
  const items: TMapped[] = []
  let cursor: string | null = null
  let hasNextPage = true
  let totalCount: number | null = null
  let truncation: PaginationTruncation | null = null

  while (hasNextPage && items.length < cap) {
    if (Date.now() - fetchStartedAt >= fetchTimeBudgetMs) {
      truncation = { fetched: items.length, totalCount, reason: 'time_budget' }
      break
    }

    let page: RawPage<TRaw> | null
    try {
      page = await fetchPage(cursor)
    } catch {
      truncation = { fetched: items.length, totalCount, reason: 'error' }
      break
    }
    if (!page) break

    totalCount = page.totalCount
    items.push(...page.nodes.map(map))
    hasNextPage = page.hasNextPage
    cursor = page.endCursor
  }

  return { items: items.slice(0, cap), truncation }
}

async function fetchMergedPage(
  owner: string,
  repo: string,
  token: string,
  after: string | null,
): Promise<RawPage<RawMergedPullRequest> | null> {
  const page = await graphqlRequest<MergedPrsPageResponse>(
    MERGED_PRS_PAGE_QUERY,
    { owner, name: repo, prPageSize: CAPS.mergedPrsPageSize, commitsPerPr: CAPS.commitsPerPr, after },
    token,
  )
  const pullRequests = page.repository?.pullRequests
  if (!pullRequests) return null
  return {
    totalCount: pullRequests.totalCount,
    hasNextPage: pullRequests.pageInfo.hasNextPage,
    endCursor: pullRequests.pageInfo.endCursor,
    nodes: pullRequests.nodes,
  }
}

async function fetchClosedPage(
  owner: string,
  repo: string,
  token: string,
  after: string | null,
): Promise<RawPage<RawClosedPullRequest> | null> {
  const page = await graphqlRequest<ClosedPrsPageResponse>(
    CLOSED_PRS_PAGE_QUERY,
    {
      owner,
      name: repo,
      closedPrPageSize: CAPS.closedPrsPageSize,
      secondaryCommitsPerPr: CAPS.secondaryCommitsPerPr,
      after,
    },
    token,
  )
  const pullRequests = page.repository?.pullRequests
  if (!pullRequests) return null
  return {
    totalCount: pullRequests.totalCount,
    hasNextPage: pullRequests.pageInfo.hasNextPage,
    endCursor: pullRequests.pageInfo.endCursor,
    nodes: pullRequests.nodes,
  }
}

function fetchMergedPullRequests(
  owner: string,
  repo: string,
  token: string,
  fetchStartedAt: number,
  fetchTimeBudgetMs: number,
): Promise<PaginationResult<MergedPullRequest>> {
  return paginate({
    fetchStartedAt,
    fetchTimeBudgetMs,
    cap: CAPS.maxMergedPrs,
    map: mapMergedPullRequest,
    fetchPage: (after) => fetchMergedPage(owner, repo, token, after),
  })
}

function fetchClosedPullRequests(
  owner: string,
  repo: string,
  token: string,
  fetchStartedAt: number,
  fetchTimeBudgetMs: number,
): Promise<PaginationResult<ClosedPullRequest>> {
  return paginate({
    fetchStartedAt,
    fetchTimeBudgetMs,
    cap: CAPS.maxClosedPrs,
    map: mapClosedPullRequest,
    fetchPage: (after) => fetchClosedPage(owner, repo, token, after),
  })
}

/**
 * Fetches a full `RepoSnapshot` from the GitHub GraphQL API for `owner/repo`.
 * Throws a typed `RepoError` for not-found/private/rate-limited/upstream
 * failures (from the meta query -- a repository that can't even be
 * identified can't produce any snapshot). Merged- and closed-PR pagination
 * failures are tolerated per-list instead (see `paginate` above): the
 * returned snapshot's `truncated` field honestly reports which list(s), if
 * any, were cut short and why (Unit 1).
 */
export interface FetchRepoSnapshotOptions {
  /**
   * Overrides `CAPS.fetchTimeBudgetMs` for this call. `scripts/fixture.ts`
   * passes `Number.POSITIVE_INFINITY` here: a bundled fixture is meant to be
   * a complete, offline-reusable snapshot, never one silently cut short by
   * the live-request budget that exists to protect a serverless request's
   * own wall-clock limit (Unit 1). Server requests (`getRepoSnapshot.ts`)
   * omit this, so they get the real budget.
   */
  fetchTimeBudgetMs?: number
}

export async function fetchRepoSnapshotFromGitHub(
  owner: string,
  repo: string,
  token: string,
  options: FetchRepoSnapshotOptions = {},
): Promise<RepoSnapshot> {
  const fetchStartedAt = Date.now()
  const fetchTimeBudgetMs = options.fetchTimeBudgetMs ?? CAPS.fetchTimeBudgetMs

  // Unit 1: the cheap meta query and the two independent PR pagination loops
  // all start at the same time and run fully concurrently -- previously,
  // merged-PR pagination could only begin once the (heavier, mergedPRs-
  // bearing) overview query had already resolved.
  const [metaResponse, mergedResult, closedResult] = await Promise.all([
    graphqlRequest<RepoMetaResponse>(
      REPO_META_QUERY,
      { owner, name: repo, secondaryCommitsPerPr: CAPS.secondaryCommitsPerPr, directCommitsScanned: CAPS.directCommitsScanned },
      token,
    ),
    fetchMergedPullRequests(owner, repo, token, fetchStartedAt, fetchTimeBudgetMs),
    fetchClosedPullRequests(owner, repo, token, fetchStartedAt, fetchTimeBudgetMs),
  ])

  const repository = metaResponse.repository
  if (!repository) {
    throw new RepoError('not_found', `Repository ${owner}/${repo} was not found.`)
  }

  const releases =
    repository.releases.totalCount > 0
      ? mapReleases(repository.releases.nodes)
      : mapTagsAsReleases(repository.tags.nodes)

  const historyNodes = repository.defaultBranchRef?.target?.history.nodes ?? []

  const truncated: FetchTruncation = {}
  if (mergedResult.truncation) truncated.mergedPullRequests = mergedResult.truncation
  if (closedResult.truncation) truncated.closedPullRequests = closedResult.truncation

  return {
    meta: {
      owner,
      name: repository.name,
      description: repository.description,
      url: repository.url,
      stars: repository.stargazerCount,
      forks: repository.forkCount,
      createdAt: repository.createdAt,
      pushedAt: repository.pushedAt,
      defaultBranch: repository.defaultBranchRef?.name ?? 'main',
      license: repository.licenseInfo?.name ?? null,
    },
    languages: mapLanguages(repository.languages?.edges),
    releases,
    mergedPullRequests: mergedResult.items,
    openPullRequests: repository.openPRs.nodes.slice(0, CAPS.maxOpenPrs).map(mapOpenPullRequest),
    closedPullRequests: closedResult.items,
    liveBranches: mapBranches(repository.branches.nodes).slice(0, CAPS.maxBranches),
    directCommits: mapDirectCommits(historyNodes),
    fetchedAt: new Date().toISOString(),
    source: 'github',
    ...(Object.keys(truncated).length > 0 ? { truncated } : {}),
  }
}
