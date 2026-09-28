/**
 * Maps a tree element id back to a detail view-model built from real
 * repository data (P8: "every visible element maps to real data"). Pure --
 * no React, no three.js, no fetch. This is what T6's detail panel and
 * accessible "Explore list" both render from.
 */
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from './repo'
import { findTreeElement, type TreeModel } from './tree'

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

export interface EraDetail {
  kind: 'era'
  id: string
  /** The release that opened this era, if any (eras can also start at a fixed cadence -- see `eras.ts`). */
  openingRelease: { name: string; tag: string; url: string } | null
  startTime: number
  endTime: number
  /** True total merged PRs in this era (including any beyond the per-limb twig cap). */
  mergedPrCount: number
  /** How many of those are rendered as twigs (the rest fold into extra leaf density). */
  twigCount: number
  overflowPrCount: number
  /** Sum of `commitCount` across the era's rendered (twig) PRs -- real data, may undercount overflow PRs. */
  commitCount: number
}

export interface PullRequestCommitEntry {
  oid: string
  headline: string
  /** The matching leaf element id, if this commit is rendered in the tree (clickable to focus it). */
  elementId: string | null
}

export interface PullRequestDetail {
  kind: 'pull_request'
  id: string
  /** `'closed'` (closed-unmerged) is only ever produced by the network model (M2) -- the tree model has no dead-end concept. */
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

export type ElementDetail = RepoOverviewDetail | EraDetail | PullRequestDetail | CommitDetail | ReleaseDetail | BranchDetail

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function findMergedPr(snapshot: RepoSnapshot, number: string): MergedPullRequest | null {
  return snapshot.mergedPullRequests.find((pr) => String(pr.number) === number) ?? null
}

function buildPullRequestDetail(id: string, pr: MergedPullRequest, model: TreeModel): PullRequestDetail {
  const leafIds = new Set(model.leaves.map((leaf) => leaf.id))
  return {
    kind: 'pull_request',
    id,
    status: 'merged',
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    date: toEpochMs(pr.mergedAt),
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    labels: pr.labels,
    commitCount: pr.commitCount,
    commits: pr.commits.map((commit) => {
      const candidateId = `leaf-pr${pr.number}-${commit.oid}`
      return {
        oid: commit.oid,
        headline: commit.messageHeadline,
        elementId: leafIds.has(candidateId) ? candidateId : null,
      }
    }),
  }
}

/** Resolves a tree element id to its detail view-model, or `null` for an unknown id. */
export function resolveElementDetail(model: TreeModel, snapshot: RepoSnapshot, id: string): ElementDetail | null {
  if (id === 'trunk') {
    return {
      kind: 'repo',
      id: 'trunk',
      owner: snapshot.meta.owner,
      name: snapshot.meta.name,
      description: snapshot.meta.description,
      url: snapshot.meta.url,
      stars: snapshot.meta.stars,
      forks: snapshot.meta.forks,
      createdAt: toEpochMs(snapshot.meta.createdAt),
      defaultBranch: snapshot.meta.defaultBranch,
    }
  }

  const element = findTreeElement(model, id)
  if (!element) return null

  // Dispatch on element *kind*, not `ref.type`: a limb and a flower can both
  // carry `ref.type === 'release'` (a limb references the release that
  // opened its era; a flower *is* that release), and a leaf can carry either
  // `commit` (the normal case) or `pull_request` (an overflow leaf with no
  // matching commit -- see `buildOverflowLeaves`).
  switch (element.kind) {
    case 'limb': {
      const nextLimb = model.limbs[element.eraIndex + 1]
      const endTime = nextLimb ? nextLimb.time : model.bounds.lastEventTime
      const twigsInLimb = model.twigs.filter((twig) => twig.limbId === element.id)
      const commitCount = twigsInLimb.reduce((sum, twig) => {
        const pr = findMergedPr(snapshot, twig.ref.id)
        return sum + (pr?.commitCount ?? 0)
      }, 0)
      const openingRelease =
        element.ref.type === 'release'
          ? (() => {
              const release = snapshot.releases.find((r) => r.tag === element.ref.id)
              return release ? { name: release.name, tag: release.tag, url: release.url } : null
            })()
          : null
      const detail: EraDetail = {
        kind: 'era',
        id: element.id,
        openingRelease,
        startTime: element.time,
        endTime,
        mergedPrCount: element.activity,
        twigCount: twigsInLimb.length,
        overflowPrCount: element.overflowPrCount,
        commitCount,
      }
      return detail
    }

    case 'twig':
    case 'fruit': {
      const merged = findMergedPr(snapshot, element.ref.id)
      if (!merged) return null
      return buildPullRequestDetail(id, merged, model)
    }

    case 'leaf': {
      if (element.ref.type === 'pull_request') {
        const merged = findMergedPr(snapshot, element.ref.id)
        return merged ? buildPullRequestDetail(id, merged, model) : null
      }
      for (const pr of snapshot.mergedPullRequests) {
        const commit = pr.commits.find((c) => c.oid === element.ref.id)
        if (commit) {
          const detail: CommitDetail = {
            kind: 'commit',
            id,
            oid: commit.oid,
            headline: commit.messageHeadline,
            date: toEpochMs(commit.authoredDate),
            author: commit.author,
            url: commit.url,
            parentPr: { number: pr.number, title: pr.title, elementId: `twig-pr${pr.number}` },
          }
          return detail
        }
      }
      const direct = snapshot.directCommits.find((c) => c.oid === element.ref.id)
      if (direct) {
        const detail: CommitDetail = {
          kind: 'commit',
          id,
          oid: direct.oid,
          headline: direct.messageHeadline,
          date: toEpochMs(direct.authoredDate),
          author: direct.author,
          url: direct.url,
          parentPr: null,
        }
        return detail
      }
      return null
    }

    case 'flower': {
      const release = snapshot.releases.find((r) => r.tag === element.ref.id)
      if (!release) return null
      const detail: ReleaseDetail = {
        kind: 'release',
        id,
        name: release.name,
        tag: release.tag,
        date: toEpochMs(release.date),
        url: release.url,
      }
      return detail
    }

    case 'bud': {
      if (element.ref.type === 'branch') {
        const branch = snapshot.liveBranches.find((b) => b.name === element.ref.id)
        if (!branch) return null
        const detail: BranchDetail = {
          kind: 'branch',
          id,
          name: branch.name,
          lastCommitDate: toEpochMs(branch.lastCommitDate),
          url: `${snapshot.meta.url}/tree/${branch.name}`,
        }
        return detail
      }
      const open = snapshot.openPullRequests.find((pr) => String(pr.number) === element.ref.id)
      if (!open) return null
      const detail: PullRequestDetail = {
        kind: 'pull_request',
        id,
        status: 'open',
        number: open.number,
        title: open.title,
        url: open.url,
        author: open.author,
        date: toEpochMs(open.createdAt),
        additions: null,
        deletions: null,
        changedFiles: null,
        labels: [],
        commitCount: null,
        commits: [],
      }
      return detail
    }

    default:
      return null
  }
}

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
    case 'era':
      return {
        kindLabel: 'Era',
        title: detail.openingRelease ? `Opened by ${detail.openingRelease.name}` : 'Era',
        date: detail.startTime,
      }
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
