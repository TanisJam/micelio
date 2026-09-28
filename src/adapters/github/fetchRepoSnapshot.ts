import { RepoError } from '../../domain/errors.ts'
import type { ClosedPullRequest, MergedPullRequest, RepoSnapshot } from '../../domain/repo.ts'
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
import { CLOSED_PRS_PAGE_QUERY, MERGED_PRS_PAGE_QUERY, REPO_OVERVIEW_QUERY } from './queries.ts'
import type { ClosedPrsPageResponse, MergedPrsPageResponse, RepoOverviewResponse } from './rawTypes.ts'

/**
 * Fetches a full `RepoSnapshot` from the GitHub GraphQL API for `owner/repo`,
 * paginating merged pull requests up to `CAPS.maxMergedPrs`. Throws a typed
 * `RepoError` for not-found/private/rate-limited/upstream failures.
 */
export async function fetchRepoSnapshotFromGitHub(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoSnapshot> {
  const overview = await graphqlRequest<RepoOverviewResponse>(
    REPO_OVERVIEW_QUERY,
    {
      owner,
      name: repo,
      prPageSize: CAPS.mergedPrsPageSize,
      commitsPerPr: CAPS.commitsPerPr,
      secondaryCommitsPerPr: CAPS.secondaryCommitsPerPr,
      directCommitsScanned: CAPS.directCommitsScanned,
    },
    token,
  )

  const repository = overview.repository
  if (!repository) {
    throw new RepoError('not_found', `Repository ${owner}/${repo} was not found.`)
  }

  const mergedPullRequests: MergedPullRequest[] = repository.mergedPRs.nodes.map(mapMergedPullRequest)
  let pageInfo = repository.mergedPRs.pageInfo

  while (pageInfo.hasNextPage && mergedPullRequests.length < CAPS.maxMergedPrs) {
    const page = await graphqlRequest<MergedPrsPageResponse>(
      MERGED_PRS_PAGE_QUERY,
      {
        owner,
        name: repo,
        prPageSize: CAPS.mergedPrsPageSize,
        commitsPerPr: CAPS.commitsPerPr,
        after: pageInfo.endCursor,
      },
      token,
    )
    const pullRequests = page.repository?.pullRequests
    if (!pullRequests) break

    mergedPullRequests.push(...pullRequests.nodes.map(mapMergedPullRequest))
    pageInfo = pullRequests.pageInfo
  }

  const cappedMergedPullRequests = mergedPullRequests.slice(0, CAPS.maxMergedPrs)

  // Closed-unmerged PRs are fetched as their own fully independent,
  // always-paginated-from-scratch query (not bundled into the overview
  // query above): a supplementary, "most recent, capped" dataset (dead-end
  // hyphae), not the core timeline, so a failure at any point -- including
  // the very first page -- stops fetching and keeps whatever pages already
  // succeeded (possibly none) instead of failing the whole snapshot. The
  // result is honestly a shorter (never fabricated) list. Splitting this
  // out of the overview query also keeps that query's own cost lower,
  // avoiding the intermittent upstream 502/504s a three-way (merged + open
  // + closed, each with nested commits) overview query triggered on
  // repositories with substantial PR history.
  const closedPullRequests: ClosedPullRequest[] = []
  let closedCursor: string | null = null
  let closedHasNextPage = true

  while (closedHasNextPage && closedPullRequests.length < CAPS.maxClosedPrs) {
    let page: ClosedPrsPageResponse
    try {
      page = await graphqlRequest<ClosedPrsPageResponse>(
        CLOSED_PRS_PAGE_QUERY,
        {
          owner,
          name: repo,
          closedPrPageSize: CAPS.closedPrsPageSize,
          secondaryCommitsPerPr: CAPS.secondaryCommitsPerPr,
          after: closedCursor,
        },
        token,
      )
    } catch {
      break
    }
    const pullRequests = page.repository?.pullRequests
    if (!pullRequests) break

    closedPullRequests.push(...pullRequests.nodes.map(mapClosedPullRequest))
    closedHasNextPage = pullRequests.pageInfo.hasNextPage
    closedCursor = pullRequests.pageInfo.endCursor
  }

  const cappedClosedPullRequests = closedPullRequests.slice(0, CAPS.maxClosedPrs)

  const releases =
    repository.releases.totalCount > 0
      ? mapReleases(repository.releases.nodes)
      : mapTagsAsReleases(repository.tags.nodes)

  const historyNodes = repository.defaultBranchRef?.target?.history.nodes ?? []

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
    mergedPullRequests: cappedMergedPullRequests,
    openPullRequests: repository.openPRs.nodes.slice(0, CAPS.maxOpenPrs).map(mapOpenPullRequest),
    closedPullRequests: cappedClosedPullRequests,
    liveBranches: mapBranches(repository.branches.nodes).slice(0, CAPS.maxBranches),
    directCommits: mapDirectCommits(historyNodes),
    fetchedAt: new Date().toISOString(),
    source: 'github',
  }
}
