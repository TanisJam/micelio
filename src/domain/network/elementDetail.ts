/**
 * Maps a network element id back to a detail view-model built from real
 * repository data (P8: "every visible element maps to real data") --
 * network counterpart of `../elementDetail`, reusing the exact same
 * `ElementDetail` union/shape so the detail panel and Explore list can stay
 * metaphor-agnostic. Pure -- no React, no three.js, no fetch.
 */
import type {
  BranchDetail,
  CommitDetail,
  ElementDetail,
  PullRequestDetail,
  PullRequestCommitEntry,
  ReleaseDetail,
  RepoOverviewDetail,
} from '../elementDetail'
import type { ClosedPullRequest, CommitAuthor, MergedPullRequest, OpenPullRequest, RepoSnapshot } from '../repo'
import { findNetworkElement } from './lookup'
import type { NetworkModel } from './types'

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

interface PrLike {
  number: number
  title: string
  url: string
  author: CommitAuthor
  commits: { oid: string; messageHeadline: string }[]
  commitCount: number
}

function findPr(snapshot: RepoSnapshot, kind: 'merged' | 'closed' | 'open', number: string): PrLike | null {
  if (kind === 'merged') return snapshot.mergedPullRequests.find((pr) => String(pr.number) === number) ?? null
  if (kind === 'closed') return snapshot.closedPullRequests.find((pr) => String(pr.number) === number) ?? null
  return snapshot.openPullRequests.find((pr) => String(pr.number) === number) ?? null
}

function buildPullRequestDetail(
  id: string,
  pr: MergedPullRequest | ClosedPullRequest | OpenPullRequest,
  hyphaId: string,
  status: 'merged' | 'closed' | 'open',
  date: number,
  nodeIds: Set<string>,
): PullRequestDetail {
  const commits: PullRequestCommitEntry[] = pr.commits.map((commit) => {
    const candidateId = `node-${hyphaId}-commit-${commit.oid}`
    return { oid: commit.oid, headline: commit.messageHeadline, elementId: nodeIds.has(candidateId) ? candidateId : null }
  })

  const hasFinancials = 'additions' in pr
  return {
    kind: 'pull_request',
    id,
    status,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    date,
    additions: hasFinancials ? pr.additions : null,
    deletions: hasFinancials ? pr.deletions : null,
    changedFiles: hasFinancials ? pr.changedFiles : null,
    labels: hasFinancials ? pr.labels : [],
    commitCount: pr.commitCount,
    commits,
  }
}

/** Resolves a network element id to its detail view-model, or `null` for an unknown id. */
export function resolveNetworkElementDetail(model: NetworkModel, snapshot: RepoSnapshot, id: string): ElementDetail | null {
  if (id === 'spore') {
    const detail: RepoOverviewDetail = {
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
    return detail
  }

  const element = findNetworkElement(model, id)
  if (!element) return null

  const nodeIds = new Set(model.nodes.map((node) => node.id))

  switch (element.kind) {
    case 'main': {
      const detail: BranchDetail = {
        kind: 'branch',
        id,
        name: snapshot.meta.defaultBranch,
        lastCommitDate: toEpochMs(snapshot.meta.pushedAt),
        url: `${snapshot.meta.url}/tree/${snapshot.meta.defaultBranch}`,
      }
      return detail
    }

    case 'merged':
    case 'closed':
    case 'open': {
      const status = element.kind === 'merged' ? 'merged' : element.kind === 'closed' ? 'closed' : 'open'
      const pr = findPr(snapshot, element.kind, element.ref.id)
      if (!pr) return null
      return buildPullRequestDetail(id, pr as MergedPullRequest | ClosedPullRequest | OpenPullRequest, element.id, status, element.endTime, nodeIds)
    }

    case 'liveBranch': {
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

    case 'node': {
      if (element.ref.type === 'pull_request') {
        // A merge-point node on the main hypha.
        const pr = findPr(snapshot, 'merged', element.ref.id)
        if (!pr) return null
        return buildPullRequestDetail(id, pr as MergedPullRequest, `hypha-pr${pr.number}`, 'merged', element.time, nodeIds)
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
            parentPr: { number: pr.number, title: pr.title, elementId: `hypha-pr${pr.number}` },
          }
          return detail
        }
      }
      for (const pr of [...snapshot.closedPullRequests, ...snapshot.openPullRequests]) {
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
            parentPr: { number: pr.number, title: pr.title, elementId: `hypha-pr${pr.number}` },
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

    case 'tip': {
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
      const pr = findPr(snapshot, 'open', element.ref.id)
      if (!pr) return null
      return buildPullRequestDetail(id, pr as OpenPullRequest, element.hyphaId, 'open', element.time, nodeIds)
    }

    case 'mushroom': {
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

    default:
      return null
  }
}
