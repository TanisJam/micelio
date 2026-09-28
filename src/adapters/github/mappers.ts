import type {
  ClosedPullRequest,
  CommitAuthor,
  LanguageShare,
  LiveBranch,
  MergedPullRequest,
  OpenPullRequest,
  PrCommit,
  ReleaseInfo,
  DirectCommit,
} from '../../domain/repo.ts'
import { CAPS } from './caps.ts'
import type {
  RawActor,
  RawBranchRef,
  RawClosedPullRequest,
  RawCommit,
  RawGitActor,
  RawHistoryCommit,
  RawLanguageEdge,
  RawMergedPullRequest,
  RawOpenPullRequest,
  RawPrCommitNode,
  RawRelease,
  RawReleaseTagTarget,
  RawTagRef,
} from './rawTypes.ts'

export function mapActor(actor: RawActor | null | undefined): CommitAuthor {
  return {
    login: actor?.login ?? null,
    avatarUrl: actor?.avatarUrl ?? null,
  }
}

export function mapGitActor(actor: RawGitActor | null | undefined): CommitAuthor {
  return {
    login: actor?.user?.login ?? null,
    avatarUrl: actor?.user?.avatarUrl ?? null,
  }
}

export function mapCommit(raw: RawCommit): PrCommit {
  return {
    oid: raw.oid,
    messageHeadline: raw.messageHeadline,
    authoredDate: raw.authoredDate,
    url: raw.url,
    author: mapGitActor(raw.author),
  }
}

/**
 * Earliest authored/committed time across a PR's (possibly capped) fetched
 * commits -- min(authoredDate, committedDate) per commit, then the overall
 * minimum -- falling back to `fallbackCreatedAt` when no commits were
 * fetched. Returned as a normalized ISO string.
 */
export function computeFirstCommitTime(nodes: RawPrCommitNode[], fallbackCreatedAt: string): string {
  let earliest: number | null = null
  for (const node of nodes) {
    const authored = Date.parse(node.commit.authoredDate)
    const committed = node.commit.committedDate ? Date.parse(node.commit.committedDate) : Number.NaN
    for (const candidate of [authored, committed]) {
      if (Number.isFinite(candidate) && (earliest === null || candidate < earliest)) {
        earliest = candidate
      }
    }
  }
  if (earliest === null) return fallbackCreatedAt
  return new Date(earliest).toISOString()
}

export function mapMergedPullRequest(raw: RawMergedPullRequest): MergedPullRequest {
  const commits = raw.commits.nodes.slice(0, CAPS.commitsPerPr).map((node) => mapCommit(node.commit))
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    mergedAt: raw.mergedAt,
    baseRefName: raw.baseRefName,
    headRefName: raw.headRefName,
    firstCommitTime: computeFirstCommitTime(raw.commits.nodes, raw.createdAt),
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    author: mapActor(raw.author),
    labels: raw.labels.nodes.map((label) => label.name),
    commitCount: raw.commits.totalCount,
    commits,
  }
}

export function mapClosedPullRequest(raw: RawClosedPullRequest): ClosedPullRequest {
  const commits = raw.commits.nodes.slice(0, CAPS.secondaryCommitsPerPr).map((node) => mapCommit(node.commit))
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    closedAt: raw.closedAt,
    baseRefName: raw.baseRefName,
    headRefName: raw.headRefName,
    firstCommitTime: computeFirstCommitTime(raw.commits.nodes, raw.createdAt),
    author: mapActor(raw.author),
    commitCount: raw.commits.totalCount,
    commits,
  }
}

export function mapOpenPullRequest(raw: RawOpenPullRequest): OpenPullRequest {
  const commits = raw.commits.nodes.slice(0, CAPS.secondaryCommitsPerPr).map((node) => mapCommit(node.commit))
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    baseRefName: raw.baseRefName,
    headRefName: raw.headRefName,
    firstCommitTime: computeFirstCommitTime(raw.commits.nodes, raw.createdAt),
    author: mapActor(raw.author),
    commitCount: raw.commits.totalCount,
    commits,
  }
}

export function mapLanguages(edges: RawLanguageEdge[] | undefined): LanguageShare[] {
  if (!edges) return []
  return edges.map((edge) => ({
    name: edge.node.name,
    color: edge.node.color,
    bytes: edge.size,
  }))
}

/** Resolves the commit `oid` a release's tag points at, drilling through an annotated tag object when present. */
export function resolveReleaseTargetOid(tag: { target: RawReleaseTagTarget | null } | null | undefined): string | null {
  const target = tag?.target
  if (!target) return null
  return target.oid ?? target.target?.oid ?? null
}

export function mapReleases(releases: RawRelease[]): ReleaseInfo[] {
  return releases.map((release) => ({
    name: release.name ?? release.tagName,
    tag: release.tagName,
    date: release.publishedAt ?? release.createdAt,
    url: release.url,
    targetOid: resolveReleaseTargetOid(release.tag),
  }))
}

/**
 * Fallback for repositories with no releases: synthesize `ReleaseInfo`
 * entries from lightweight/annotated tags.
 */
export function mapTagsAsReleases(tags: RawTagRef[]): ReleaseInfo[] {
  const result: ReleaseInfo[] = []
  for (const tag of tags) {
    const target = tag.target
    if (!target) continue

    if ('committedDate' in target) {
      result.push({
        name: tag.name,
        tag: tag.name,
        date: target.committedDate,
        url: target.url,
        targetOid: target.oid ?? null,
      })
      continue
    }

    const annotatedTarget = target.target
    const date = target.tagger?.date ?? annotatedTarget?.committedDate
    const url = annotatedTarget?.url
    if (date && url) {
      result.push({ name: tag.name, tag: tag.name, date, url, targetOid: annotatedTarget?.oid ?? null })
    }
  }
  return result
}

export function mapBranches(branches: RawBranchRef[]): LiveBranch[] {
  const result: LiveBranch[] = []
  for (const branch of branches) {
    if (!branch.target) continue
    result.push({ name: branch.name, lastCommitDate: branch.target.committedDate })
  }
  return result
}

/**
 * Keeps default-branch commits that have no associated pull request (i.e.
 * were pushed directly), capped to `CAPS.maxDirectCommits`.
 */
export function mapDirectCommits(history: RawHistoryCommit[]): DirectCommit[] {
  return history
    .filter((commit) => commit.associatedPullRequests.totalCount === 0)
    .slice(0, CAPS.maxDirectCommits)
    .map((commit) => ({
      oid: commit.oid,
      messageHeadline: commit.messageHeadline,
      authoredDate: commit.authoredDate,
      url: commit.url,
      author: mapGitActor(commit.author),
    }))
}
