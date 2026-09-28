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
  url: string
  author: RawGitActor | null
}

export interface RawHistoryCommit extends RawCommit {
  associatedPullRequests: { totalCount: number }
}

export interface RawPrCommitNode {
  commit: RawCommit
}

export interface RawMergedPullRequest {
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
  commits: {
    totalCount: number
    nodes: RawPrCommitNode[]
  }
}

export interface RawOpenPullRequest {
  number: number
  title: string
  url: string
  createdAt: string
  author: RawActor | null
}

export interface RawLanguageEdge {
  size: number
  node: { name: string; color: string | null }
}

export interface RawRelease {
  name: string | null
  tagName: string
  url: string
  publishedAt: string | null
  createdAt: string
}

export interface RawTagRef {
  name: string
  target:
    | { committedDate: string; url: string }
    | { tagger: { date: string } | null; target: { committedDate: string; url: string } | null }
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

export interface RawRepositoryOverview {
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
  mergedPRs: { pageInfo: RawPageInfo; nodes: RawMergedPullRequest[] }
}

export interface RepoOverviewResponse {
  repository: RawRepositoryOverview | null
}

export interface MergedPrsPageResponse {
  repository: {
    pullRequests: { pageInfo: RawPageInfo; nodes: RawMergedPullRequest[] }
  } | null
}
