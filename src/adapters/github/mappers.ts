import type {
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
  RawCommit,
  RawGitActor,
  RawHistoryCommit,
  RawLanguageEdge,
  RawMergedPullRequest,
  RawOpenPullRequest,
  RawRelease,
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

export function mapMergedPullRequest(raw: RawMergedPullRequest): MergedPullRequest {
  const commits = raw.commits.nodes.slice(0, CAPS.commitsPerPr).map((node) => mapCommit(node.commit))
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    mergedAt: raw.mergedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    author: mapActor(raw.author),
    labels: raw.labels.nodes.map((label) => label.name),
    commitCount: raw.commits.totalCount,
    commits,
  }
}

export function mapOpenPullRequest(raw: RawOpenPullRequest): OpenPullRequest {
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    author: mapActor(raw.author),
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

export function mapReleases(releases: RawRelease[]): ReleaseInfo[] {
  return releases.map((release) => ({
    name: release.name ?? release.tagName,
    tag: release.tagName,
    date: release.publishedAt ?? release.createdAt,
    url: release.url,
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
      result.push({ name: tag.name, tag: tag.name, date: target.committedDate, url: target.url })
      continue
    }

    const annotatedTarget = target.target
    const date = target.tagger?.date ?? annotatedTarget?.committedDate
    const url = annotatedTarget?.url
    if (date && url) {
      result.push({ name: tag.name, tag: tag.name, date, url })
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
