/**
 * Shapes returned by the GitHub GraphQL API for the queries in `queries.ts`.
 * These mirror GitHub's schema (not our domain model) — mapping into the
 * domain model happens in `mappers.ts`.
 */

export interface RawActor {
  login: string | null
  avatarUrl: string | null
}

export interface RawGitActor {
  name: string | null
  user: RawActor | null
}

export interface RawCommit {
  oid: string
  messageHeadline: string
  authoredDate: string
  /**
   * Optional: only requested where "first commit time" needs to consider
   * both authored and committed dates (PR commit lists, not direct-history
   * commits).
   */
  committedDate?: string
  url: string
  author: RawGitActor | null
}

export interface RawHistoryCommit extends RawCommit {
  associatedPullRequests: { totalCount: number }
}

export interface RawPrCommitNode {
  commit: RawCommit
}

export interface RawPrCommits {
  totalCount: number
  nodes: RawPrCommitNode[]
}

/** Branch topology fields shared by merged/closed/open PR raw shapes. */
export interface RawPrRefFields {
  baseRefName: string
  headRefName: string
}

export interface RawMergedPullRequest extends RawPrRefFields {
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt: string
  additions: number
  deletions: number
  changedFiles: number
  author: RawActor | null
  labels: { nodes: { name: string }[] }
  commits: RawPrCommits
}

export interface RawClosedPullRequest extends RawPrRefFields {
  number: number
  title: string
  url: string
  createdAt: string
  closedAt: string
  author: RawActor | null
  commits: RawPrCommits
}

export interface RawOpenPullRequest extends RawPrRefFields {
  number: number
  title: string
  url: string
  createdAt: string
  author: RawActor | null
  commits: RawPrCommits
}

export interface RawLanguageEdge {
  size: number
  node: { name: string; color: string | null }
}

/**
 * A tag's `target` GitObject: a direct `oid` when it points straight at a
 * commit, or a nested `target.oid` when it's an annotated tag object
 * wrapping a commit (mirrors the inline-fragment shape requested in
 * `queries.ts`).
 */
export interface RawReleaseTagTarget {
  oid?: string
  target?: { oid?: string } | null
}

export interface RawRelease {
  name: string | null
  tagName: string
  url: string
  publishedAt: string | null
  createdAt: string
  /** Present when the release has a resolvable tag ref; used to cheaply derive `targetOid`. */
  tag: { target: RawReleaseTagTarget | null } | null
}

export interface RawTagRef {
  name: string
  target:
    | { committedDate: string; url: string; oid?: string }
    | { tagger: { date: string } | null; target: { committedDate: string; url: string; oid?: string } | null }
    | null
}

export interface RawBranchRef {
  name: string
  target: { committedDate: string } | null
}

export interface RawPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

/** Unit 1: the cheap single-page "meta" shape (`REPO_META_QUERY`) -- no `mergedPRs` connection of its own, see `queries.ts`. */
export interface RawRepositoryMeta {
  name: string
  description: string | null
  url: string
  stargazerCount: number
  forkCount: number
  createdAt: string
  pushedAt: string
  defaultBranchRef: {
    name: string
    target: { history: { nodes: RawHistoryCommit[] } } | null
  } | null
  licenseInfo: { name: string } | null
  languages: { edges: RawLanguageEdge[] } | null
  releases: { totalCount: number; nodes: RawRelease[] }
  tags: { nodes: RawTagRef[] }
  branches: { nodes: RawBranchRef[] }
  openPRs: { nodes: RawOpenPullRequest[] }
}

export interface RepoMetaResponse {
  repository: RawRepositoryMeta | null
}

/** A paginated connection that also reports its repo-wide `totalCount`, used to report honest "N of totalCount" truncation notes (Unit 1). */
export interface RawCountedPage<T> {
  totalCount: number
  pageInfo: RawPageInfo
  nodes: T[]
}

export interface MergedPrsPageResponse {
  repository: {
    pullRequests: RawCountedPage<RawMergedPullRequest>
  } | null
}

export interface ClosedPrsPageResponse {
  repository: {
    pullRequests: RawCountedPage<RawClosedPullRequest>
  } | null
}
