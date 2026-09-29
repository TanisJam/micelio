/**
 * The shared `ElementDetail` view-model shape (P8: "every visible element
 * maps to real data"), built from real repository data. Pure -- no React,
 * no three.js, no fetch. The mycelium network's own resolver
 * (`network/elementDetail.ts`, `resolveNetworkElementDetail`) builds these
 * from a `NetworkModel`; this module only holds the shared shape and
 * `summarizeElementDetail`, which the detail panel and "Explore list" both
 * render from.
 */
import type { CommitAuthor } from './repo'

export interface RepoOverviewDetail {
  kind: 'repo'
  id: 'trunk'
  owner: string
  name: string
  description: string | null
  url: string
  stars: number
  forks: number
  createdAt: number
  defaultBranch: string
}

export interface PullRequestCommitEntry {
  oid: string
  headline: string
  /** The matching rendered-element id for this commit, if any (clickable to focus it). */
  elementId: string | null
}

/**
 * Honest wording for where a PR's hypha visually sprouts from. `'colony'`
 * means the split point is a visual sprout point, not a claimed data
 * relationship (see `Hypha.attachment` in `network/types.ts`); `'branch'`
 * mirrors a real base-branch-of-another-PR relationship.
 */
export type PullRequestOrigin =
  | { kind: 'colony' }
  | { kind: 'branch'; parentTitle: string; parentNumber: number; parentElementId: string }

export interface PullRequestDetail {
  kind: 'pull_request'
  id: string
  status: 'merged' | 'closed' | 'open'
  number: number
  title: string
  url: string
  author: CommitAuthor
  date: number
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  labels: string[]
  commitCount: number | null
  commits: PullRequestCommitEntry[]
  origin?: PullRequestOrigin
}

export interface CommitDetail {
  kind: 'commit'
  id: string
  oid: string
  headline: string
  date: number
  author: CommitAuthor
  url: string
  parentPr: { number: number; title: string; elementId: string } | null
}

export interface ReleaseDetail {
  kind: 'release'
  id: string
  name: string
  tag: string
  date: number
  url: string
}

export interface BranchDetail {
  kind: 'branch'
  id: string
  name: string
  lastCommitDate: number
  url: string
}

export type ElementDetail = RepoOverviewDetail | PullRequestDetail | CommitDetail | ReleaseDetail | BranchDetail

export interface ElementSummary {
  /** Short human label for the element's kind, e.g. "Merged PR", "Commit". */
  kindLabel: string
  title: string
  date: number | null
}

/** Reduces any `ElementDetail` to a short (kind, title, date) summary -- what the hover tooltip and the "Explore list" rows show. */
export function summarizeElementDetail(detail: ElementDetail): ElementSummary {
  switch (detail.kind) {
    case 'repo':
      return { kindLabel: 'Repository', title: `${detail.owner}/${detail.name}`, date: detail.createdAt }
    case 'pull_request':
      return {
        kindLabel:
          detail.status === 'merged'
            ? 'Merged pull request'
            : detail.status === 'closed'
              ? 'Closed pull request'
              : 'Open pull request',
        title: `#${detail.number} ${detail.title}`,
        date: detail.date,
      }
    case 'commit':
      return { kindLabel: 'Commit', title: detail.headline, date: detail.date }
    case 'release':
      return { kindLabel: 'Release', title: detail.name, date: detail.date }
    case 'branch':
      return { kindLabel: 'Branch', title: detail.name, date: detail.lastCommitDate }
  }
}
