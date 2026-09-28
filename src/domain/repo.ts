/**
 * Domain model for a single point-in-time snapshot of a GitHub repository's
 * history. Pure data — no React, no three.js, no fetch. This is the shape
 * the GitHub adapter produces and the tree model consumes.
 */

export interface RepoMeta {
  owner: string
  name: string
  description: string | null
  url: string
  stars: number
  forks: number
  createdAt: string
  pushedAt: string
  defaultBranch: string
  license: string | null
}

export interface LanguageShare {
  name: string
  color: string | null
  bytes: number
}

export interface ReleaseInfo {
  name: string
  tag: string
  date: string
  url: string
  /** The commit the release's tag points at, when cheaply resolvable from the GraphQL response. */
  targetOid: string | null
}

export interface CommitAuthor {
  login: string | null
  avatarUrl: string | null
}

export interface PrCommit {
  oid: string
  messageHeadline: string
  authoredDate: string
  author: CommitAuthor
  url: string
}

/**
 * Branch topology shared by every pull-request kind (merged, closed-unmerged,
 * open): which branch it targets/came from, and when its history actually
 * started. Used by the network model (M2) to place a PR's hypha as a split
 * from its parent branch's hypha.
 */
export interface PrTopology {
  baseRefName: string
  headRefName: string
  /**
   * The earliest authored/committed time across the PR's (possibly capped)
   * commits -- min(authoredDate, committedDate) per commit, then the overall
   * minimum -- falling back to `createdAt` when no commits were fetched.
   */
  firstCommitTime: string
}

export interface MergedPullRequest extends PrTopology {
  number: number
  title: string
  author: CommitAuthor
  mergedAt: string
  createdAt: string
  url: string
  additions: number
  deletions: number
  changedFiles: number
  labels: string[]
  /** Total commits on the PR, before the `commits` cap below is applied. */
  commitCount: number
  /** Capped list of commits (see `commitCount` for the true total). */
  commits: PrCommit[]
}

/** A pull request that was closed without being merged -- rendered as a dead-end hypha. */
export interface ClosedPullRequest extends PrTopology {
  number: number
  title: string
  author: CommitAuthor
  createdAt: string
  closedAt: string
  url: string
  /** Total commits on the PR, before the `commits` cap below is applied. */
  commitCount: number
  /** Capped list of commits (see `commitCount` for the true total). */
  commits: PrCommit[]
}

export interface OpenPullRequest extends PrTopology {
  number: number
  title: string
  author: CommitAuthor
  createdAt: string
  url: string
  /** Total commits on the PR, before the `commits` cap below is applied. */
  commitCount: number
  /** Capped list of commits (see `commitCount` for the true total). */
  commits: PrCommit[]
}

export interface LiveBranch {
  name: string
  lastCommitDate: string
}

export interface DirectCommit {
  oid: string
  messageHeadline: string
  authoredDate: string
  author: CommitAuthor
  url: string
}

export type RepoSnapshotSource = 'github' | 'fixture'

export interface RepoSnapshot {
  meta: RepoMeta
  languages: LanguageShare[]
  releases: ReleaseInfo[]
  mergedPullRequests: MergedPullRequest[]
  openPullRequests: OpenPullRequest[]
  /** Closed-and-not-merged pull requests, most recent first, capped (see `CAPS.maxClosedPrs`). */
  closedPullRequests: ClosedPullRequest[]
  liveBranches: LiveBranch[]
  /** Default-branch commits with no associated PR. Optional, capped, may be empty. */
  directCommits: DirectCommit[]
  /** ISO timestamp of when this snapshot was produced. */
  fetchedAt: string
  source: RepoSnapshotSource
}

/** Simple identity for a repository, used to key requests and caches. */
export interface RepoIdentity {
  owner: string
  repo: string
}
