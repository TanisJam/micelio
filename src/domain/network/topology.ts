import type { ClosedPullRequest, CommitAuthor, MergedPullRequest, OpenPullRequest, RepoSnapshot } from '../repo'
import type { TimeBounds } from '../tree/types'
import type { HyphaKind, NetworkRef } from './types'

/**
 * Pure branch-topology derivation: turns a `RepoSnapshot`'s PRs and live
 * branches into a DAG of `HyphaDraft`s (parent/child, split/fuse-or-dead-end
 * times), with no layout/geometry concerns at all. Kept in its own module so
 * the graph logic is unit-testable independently of the spiral/curvature
 * math in `layout.ts` (per the task brief: "topology first").
 */

export interface HyphaCommitDraft {
  time: number
  ref: NetworkRef
  isMergePoint: boolean
  /**
   * Only populated for a genuine direct commit on `main` (undefined for a
   * merge-point pseudo-entry and for PR-hypha commits, whose author is
   * already carried by their own `HyphaDraft.author`). Used by the colony
   * layout to place a direct commit's radial spur in its author's sector
   * (M2c) -- optional so the spiral layout, which never reads it, is
   * unaffected.
   */
  author?: CommitAuthor
}

export interface HyphaDraft {
  id: string
  kind: HyphaKind
  ref: NetworkRef
  /** `null` only for the main hypha. */
  parentHyphaId: string | null
  /** The PR's own first-commit time (or branch's last-commit time), unclamped -- kept for diagnostics/tests. */
  rawSplitTime: number
  /** `rawSplitTime` clamped to be >= the parent's own `splitTime`. */
  splitTime: number
  /** `mergedAt` / `closedAt` / the model's last event time (open, still growing). */
  endTime: number
  status: 'fused' | 'dead_end' | 'open'
  title: string
  url: string
  author: CommitAuthor
  commitCount: number
  /** Ascending by time, clamped into `[splitTime, endTime]`. */
  commits: HyphaCommitDraft[]
  /**
   * Real `additions + deletions`, when known -- only merged PRs fetch diff
   * stats (see M1/`queries.ts`; the closed/open PR fragments stay cheap and
   * don't include them). `null` for closed/open PRs, live branches and
   * `main` -- the colony layout's (M2d) work-based length formula treats a
   * missing value as 0 work-lines rather than fabricating one.
   */
  workLines: number | null
}

export interface TopologyOptions {
  /** Cap on PR-derived + live-branch hyphae kept (most recent first); default ~1000. */
  maxHyphae: number
}

export const DEFAULT_TOPOLOGY_OPTIONS: TopologyOptions = {
  maxHyphae: 1000,
}

export interface TopologyResult {
  main: HyphaDraft
  hyphae: HyphaDraft[]
  /** PR-derived + live-branch hyphae dropped by `maxHyphae`, never fabricated elsewhere. */
  hyphaeOmitted: number
}

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

interface ParentCandidate {
  hyphaId: string
  headRefName: string
  /** The candidate's own effective (clamped) split time. */
  splitTime: number
}

/** Normalized view over merged/closed/open PRs, so topology logic doesn't repeat itself per PR kind. */
interface PrSource {
  kind: 'merged' | 'closed' | 'open'
  number: number
  title: string
  url: string
  author: CommitAuthor
  baseRefName: string
  headRefName: string
  firstCommitTime: string
  commitCount: number
  commits: { oid: string; authoredDate: string }[]
  /** `mergedAt` (merged), `closedAt` (closed), or `null` (open -- still growing). */
  endAt: string | null
  /** See `HyphaDraft.workLines` -- only ever real for a merged PR. */
  workLines: number | null
}

function fromMerged(pr: MergedPullRequest): PrSource {
  return {
    kind: 'merged',
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    firstCommitTime: pr.firstCommitTime,
    commitCount: pr.commitCount,
    commits: pr.commits,
    endAt: pr.mergedAt,
    workLines: pr.additions + pr.deletions,
  }
}

function fromClosed(pr: ClosedPullRequest): PrSource {
  return {
    kind: 'closed',
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    firstCommitTime: pr.firstCommitTime,
    commitCount: pr.commitCount,
    commits: pr.commits,
    endAt: pr.closedAt,
    workLines: null,
  }
}

function fromOpen(pr: OpenPullRequest): PrSource {
  return {
    kind: 'open',
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    firstCommitTime: pr.firstCommitTime,
    commitCount: pr.commitCount,
    commits: pr.commits,
    endAt: null,
    workLines: null,
  }
}

const KIND_ORDER: Record<PrSource['kind'], number> = { merged: 0, closed: 1, open: 2 }

/**
 * Derives the hypha DAG (main + one per merged/closed/open PR, plus live
 * branches with no matching PR) from a snapshot. Deterministic: identical
 * input always produces an identical (same order, same ids, same times)
 * result.
 */
export function buildHyphaTopology(
  snapshot: RepoSnapshot,
  bounds: TimeBounds,
  options: Partial<TopologyOptions> = {},
): TopologyResult {
  const resolved: TopologyOptions = { ...DEFAULT_TOPOLOGY_OPTIONS, ...options }
  const defaultBranch = snapshot.meta.defaultBranch

  const main: HyphaDraft = {
    id: 'hypha-main',
    kind: 'main',
    ref: { type: 'branch', id: defaultBranch },
    parentHyphaId: null,
    rawSplitTime: bounds.firstEventTime,
    splitTime: bounds.firstEventTime,
    endTime: bounds.lastEventTime,
    status: 'open',
    title: defaultBranch,
    url: snapshot.meta.url,
    author: { login: null, avatarUrl: null },
    commitCount: snapshot.directCommits.length,
    workLines: null,
    commits: snapshot.directCommits.map((commit) => ({
      time: clampTime(toEpochMs(commit.authoredDate), bounds.firstEventTime, bounds.lastEventTime),
      ref: { type: 'commit', id: commit.oid },
      isMergePoint: false,
      author: commit.author,
    })),
  }

  const sources: PrSource[] = [
    ...snapshot.mergedPullRequests.map(fromMerged),
    ...snapshot.closedPullRequests.map(fromClosed),
    ...snapshot.openPullRequests.map(fromOpen),
  ].sort((a, b) => {
    const timeDelta = toEpochMs(a.firstCommitTime) - toEpochMs(b.firstCommitTime)
    if (timeDelta !== 0) return timeDelta
    const kindDelta = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (kindDelta !== 0) return kindDelta
    return a.number - b.number
  })

  // Only earlier-processed hyphae are visible as parent candidates -- since
  // we process in ascending split-time order, this guarantees a child can
  // never reference a hypha that (chronologically) doesn't exist yet.
  const candidatesByHeadRef = new Map<string, ParentCandidate[]>()

  const drafts: HyphaDraft[] = []
  const hyphaByPrKey = new Map<string, HyphaDraft>()

  for (const source of sources) {
    const rawSplitTime = toEpochMs(source.firstCommitTime)
    const parent = resolveParent(source.baseRefName, rawSplitTime, defaultBranch, main, candidatesByHeadRef)
    const splitTime = Math.max(rawSplitTime, parent.splitTime)
    const endTime =
      source.endAt !== null ? clampTime(toEpochMs(source.endAt), splitTime, Number.POSITIVE_INFINITY) : bounds.lastEventTime
    const status: HyphaDraft['status'] = source.kind === 'merged' ? 'fused' : source.kind === 'closed' ? 'dead_end' : 'open'
    const ref: NetworkRef = { type: 'pull_request', id: String(source.number) }
    const id = `hypha-pr${source.number}`

    const draft: HyphaDraft = {
      id,
      kind: source.kind,
      ref,
      parentHyphaId: parent.hyphaId,
      rawSplitTime,
      splitTime,
      endTime,
      status,
      title: source.title,
      url: source.url,
      author: source.author,
      commitCount: source.commitCount,
      workLines: source.workLines,
      commits: source.commits
        .map((commit) => ({
          time: clampTime(toEpochMs(commit.authoredDate), splitTime, endTime),
          ref: { type: 'commit' as const, id: commit.oid },
          isMergePoint: false,
        }))
        .sort((a, b) => a.time - b.time),
    }

    drafts.push(draft)
    hyphaByPrKey.set(`${source.kind}:${source.number}`, draft)

    const existing = candidatesByHeadRef.get(source.headRefName) ?? []
    existing.push({ hyphaId: id, headRefName: source.headRefName, splitTime })
    candidatesByHeadRef.set(source.headRefName, existing)

    // Every merged PR also drops a merge-point node on the *main* hypha at
    // its fuse time (see `types.ts`: "merge points on the main hypha").
    if (source.kind === 'merged') {
      main.commits.push({
        time: clampTime(endTime, bounds.firstEventTime, bounds.lastEventTime),
        ref,
        isMergePoint: true,
      })
    }
  }

  // Live branches with no matching open/merged/closed PR head ref: minimal
  // open hyphae off main. `LiveBranch` carries no baseRef/commit history, so
  // `lastCommitDate` is the only available time signal -- an honest, if
  // coarse, proxy for where the branch's own work concentrates.
  const prHeadRefs = new Set(sources.map((s) => s.headRefName))
  for (const branch of snapshot.liveBranches) {
    if (branch.name === defaultBranch || prHeadRefs.has(branch.name)) continue
    const rawSplitTime = toEpochMs(branch.lastCommitDate)
    const splitTime = Math.max(rawSplitTime, main.splitTime)
    const id = `hypha-branch-${branch.name}`
    drafts.push({
      id,
      kind: 'liveBranch',
      ref: { type: 'branch', id: branch.name },
      parentHyphaId: main.id,
      rawSplitTime,
      splitTime,
      endTime: bounds.lastEventTime,
      status: 'open',
      title: branch.name,
      url: `${snapshot.meta.url}/tree/${branch.name}`,
      author: { login: null, avatarUrl: null },
      commitCount: 0,
      workLines: null,
      commits: [],
    })
  }

  main.commits.sort((a, b) => a.time - b.time)

  // Deterministic final order: chronological by split time, ties broken by id.
  drafts.sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))

  const hyphaeOmitted = Math.max(0, drafts.length - resolved.maxHyphae)
  const kept = hyphaeOmitted > 0 ? mostRecent(drafts, resolved.maxHyphae) : drafts

  // Re-parent any hypha whose parent got cut by the cap: fall back to main
  // (always kept), so the result is never internally inconsistent (a
  // dangling `parentHyphaId`) even when trimmed.
  const keptIds = new Set(kept.map((d) => d.id))
  for (const draft of kept) {
    if (draft.parentHyphaId !== null && !keptIds.has(draft.parentHyphaId)) {
      draft.parentHyphaId = main.id
      draft.splitTime = Math.max(draft.rawSplitTime, main.splitTime)
    }
  }

  return { main, hyphae: kept, hyphaeOmitted }
}

function mostRecent(drafts: HyphaDraft[], count: number): HyphaDraft[] {
  return [...drafts].sort((a, b) => b.splitTime - a.splitTime).slice(0, count).sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))
}

function clampTime(time: number, min: number, max: number): number {
  if (!Number.isFinite(time)) return min
  const floored = Math.max(time, min)
  return Number.isFinite(max) ? Math.min(floored, max) : floored
}

function resolveParent(
  baseRefName: string,
  childRawSplitTime: number,
  defaultBranch: string,
  main: HyphaDraft,
  candidatesByHeadRef: Map<string, ParentCandidate[]>,
): { hyphaId: string; splitTime: number } {
  if (baseRefName === defaultBranch) {
    return { hyphaId: main.id, splitTime: main.splitTime }
  }

  const candidates = candidatesByHeadRef.get(baseRefName)
  if (!candidates || candidates.length === 0) {
    return { hyphaId: main.id, splitTime: main.splitTime }
  }

  // The closest-preceding candidate whose own split time is still
  // time-consistent (<= the child's raw split time) -- otherwise fall back
  // to main, per the task brief.
  let best: ParentCandidate | null = null
  for (const candidate of candidates) {
    if (candidate.splitTime <= childRawSplitTime && (best === null || candidate.splitTime > best.splitTime)) {
      best = candidate
    }
  }

  if (!best) return { hyphaId: main.id, splitTime: main.splitTime }
  return { hyphaId: best.hyphaId, splitTime: best.splitTime }
}
