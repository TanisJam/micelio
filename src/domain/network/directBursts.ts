/**
 * Groups a repository's direct (non-PR) commits on the default branch into
 * WORK BURSTS: consecutive commits by the same author with a gap smaller
 * than `DIRECT_BURST_MAX_GAP_MS` between them. Each burst becomes its own
 * `direct`-kind hypha in `topology.ts` -- a real filament, not a floating
 * decorative hair (see the M2's original `buildDirectCommitSpurs`, replaced
 * for this reason: every one of its "hairs" was placed at an independently
 * found empty angle, never actually attached to any hypha's own polyline).
 *
 * Pure, deterministic (stable sort + a single linear scan), no React/three.
 */
import type { CommitAuthor, DirectCommit } from '../repo'

/** Two direct commits belong to the same burst only if they're by the SAME author (real, non-null `login`) and this close in time. Tunable. */
export const DIRECT_BURST_MAX_GAP_MS = 6 * 60 * 60 * 1000

/**
 * A burst longer than this is split into consecutive (still time-ordered,
 * still same-author) chunks of at most this many commits -- keeps a single
 * `direct` hypha's node/hair count in the same ballpark as a real PR's own
 * `maxNodesPerHypha`-capped rendering, rather than one enormous unbroken
 * burst hypha for a long solo maintenance streak.
 */
export const DIRECT_BURST_MAX_COMMITS = 40

export interface DirectCommitBurst {
  /** Ascending by `authoredDate`. */
  commits: DirectCommit[]
  /** Shared by every commit in the burst (grouping requires a matching, non-null `login`). */
  author: CommitAuthor
  firstTime: number
  lastTime: number
}

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function chunk<T>(items: T[], max: number): T[][] {
  if (items.length <= max) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += max) chunks.push(items.slice(i, i + max))
  return chunks
}

function makeBurst(commits: DirectCommit[]): DirectCommitBurst {
  const first = commits[0]!
  const last = commits[commits.length - 1]!
  return {
    commits,
    author: first.author,
    firstTime: toEpochMs(first.authoredDate),
    lastTime: toEpochMs(last.authoredDate),
  }
}

/**
 * Groups direct commits (already filtered to exclude anything associated
 * with a pull request -- see `mapDirectCommits`) into bursts. A commit with
 * no known `login` (anonymous/unlinked author) always starts its own
 * singleton burst rather than being silently merged with a neighboring
 * anonymous commit that may or may not be the same real person -- an honest
 * default, not a fabricated grouping.
 */
export function groupDirectCommitBursts(commits: DirectCommit[]): DirectCommitBurst[] {
  const sorted = [...commits].sort((a, b) => toEpochMs(a.authoredDate) - toEpochMs(b.authoredDate))

  const bursts: DirectCommitBurst[] = []
  let current: DirectCommit[] = []
  let currentLogin: string | null = null
  let lastTime = Number.NEGATIVE_INFINITY

  const flush = () => {
    if (current.length === 0) return
    for (const part of chunk(current, DIRECT_BURST_MAX_COMMITS)) bursts.push(makeBurst(part))
    current = []
  }

  for (const commit of sorted) {
    const time = toEpochMs(commit.authoredDate)
    const login = commit.author.login
    const continuesBurst = current.length > 0 && login !== null && login === currentLogin && time - lastTime <= DIRECT_BURST_MAX_GAP_MS
    if (!continuesBurst) {
      flush()
      currentLogin = login
    }
    current.push(commit)
    lastTime = time
  }
  flush()

  return bursts
}
