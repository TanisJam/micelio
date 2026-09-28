import { RepoError } from '../../domain/errors.ts'
import type { MergedPullRequest, RepoSnapshot } from '../../domain/repo.ts'
import { CAPS } from './caps.ts'
import { graphqlRequest } from './graphqlClient.ts'
import {
  mapBranches,
  mapDirectCommits,
  mapLanguages,
  mapMergedPullRequest,
  mapOpenPullRequest,
  mapReleases,
  mapTagsAsReleases,
} from './mappers.ts'
import { MERGED_PRS_PAGE_QUERY, REPO_OVERVIEW_QUERY } from './queries.ts'
import type { MergedPrsPageResponse, RepoOverviewResponse } from './rawTypes.ts'

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
    liveBranches: mapBranches(repository.branches.nodes).slice(0, CAPS.maxBranches),
    directCommits: mapDirectCommits(historyNodes),
    fetchedAt: new Date().toISOString(),
    source: 'github',
  }
}
