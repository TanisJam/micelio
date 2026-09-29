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
 * The largest a single burst's commit count is ever allowed to reach, once
 * split (see `pickChunkSize` below) -- keeps a single `direct` hypha's
 * node/hair count in the same ballpark as a real PR's own
 * `maxNodesPerHypha`-capped rendering, rather than one enormous unbroken
 * burst hypha for a long solo maintenance streak.
 */
export const DIRECT_BURST_MAX_COMMITS = 40

/**
 * The smallest a split chunk is ever allowed to shrink to -- a burst is
 * still meant to read as "a burst of commits", not a string of
 * one-commit-each hyphae manufactured purely to hit a numeric target. A
 * NATURALLY-occurring one-commit burst (a real time gap or author change
 * right after it) is untouched by this floor; it only bounds how far the
 * count-based chunk SPLIT below is allowed to go.
 */
export const DIRECT_BURST_MIN_CHUNK = 3

/**
 * Production feedback (post-final-pass): a small solo repo with one
 * unbroken same-author streak (e.g. `TanisJam/lime`, 127 direct commits, no
 * PRs) used to collapse into just `ceil(127 / 40) = 4` `direct` hyphae --
 * "only ~10 filaments clustered near the center" once combined with its one
 * real PR and a couple of branches, reading as sparse and dead rather than
 * a lush small colony. The fixed 40-commits-per-burst chunk size scaled
 * fine for a busy multi-author repo (whose NATURAL bursts -- grouped by
 * author and real time gaps, before any count-based splitting -- are
 * already short) but not for a solo repo's single long streak.
 *
 * `pickChunkSize` makes the count-based split ADAPTIVE: it targets roughly
 * `commits / DIRECT_BURST_TARGET_DIVISOR` bursts for the WHOLE scanned set
 * (clamped to `[DIRECT_BURST_MIN_TARGET, DIRECT_BURST_MAX_TARGET]`), then
 * searches for the chunk size (within `[DIRECT_BURST_MIN_CHUNK,
 * DIRECT_BURST_MAX_COMMITS]`) that, when applied to every NATURAL run,
 * lands closest to that target. A busy repo's natural runs are already
 * short (real author/gap diversity splits them well before any chunk size
 * in range would ever apply), so the search settles on a large chunk size
 * that changes nothing -- the SAME result the old fixed 40-commits cap
 * gave. A solo repo's one long natural run has nothing else to split it,
 * so the search picks a small chunk size and the streak fans out into many
 * short, still meaningful (same-author, time-contiguous) hyphae.
 */
export const DIRECT_BURST_TARGET_DIVISOR = 3.5
/** Never target fewer bursts than this for the whole scanned set (subject to `DIRECT_BURST_MIN_CHUNK` -- see `pickChunkSize`). */
export const DIRECT_BURST_MIN_TARGET = 8
/** Never target more bursts than this for the whole scanned set (keeps a very large solo streak from fragmenting into hundreds of near-single-commit slivers). */
export const DIRECT_BURST_MAX_TARGET = 300

/**
 * Searches `[DIRECT_BURST_MIN_CHUNK, DIRECT_BURST_MAX_COMMITS]` for the
 * chunk size that, applied to every natural run via `ceil(run.length /
 * chunkSize)`, produces a total burst count closest to `targetBurstCount`.
 * Ties prefer the LARGER chunk size (the more conservative choice -- change
 * as little as possible about an already-reasonable natural grouping).
 */
function pickChunkSize(naturalRunLengths: number[], targetBurstCount: number): number {
  let best = DIRECT_BURST_MAX_COMMITS
  let bestDiff = Number.POSITIVE_INFINITY
  for (let chunkSize = DIRECT_BURST_MIN_CHUNK; chunkSize <= DIRECT_BURST_MAX_COMMITS; chunkSize++) {
    let total = 0
    for (const length of naturalRunLengths) total += Math.ceil(length / chunkSize)
    const diff = Math.abs(total - targetBurstCount)
    if (diff <= bestDiff) {
      bestDiff = diff
      best = chunkSize
    }
  }
  return best
}

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

/** Groups commits into runs by author + gap only -- no count-based splitting yet. */
function groupIntoNaturalRuns(sorted: DirectCommit[]): DirectCommit[][] {
  const runs: DirectCommit[][] = []
  let current: DirectCommit[] = []
  let currentLogin: string | null = null
  let lastTime = Number.NEGATIVE_INFINITY

  for (const commit of sorted) {
    const time = toEpochMs(commit.authoredDate)
    const login = commit.author.login
    const continuesBurst = current.length > 0 && login !== null && login === currentLogin && time - lastTime <= DIRECT_BURST_MAX_GAP_MS
    if (!continuesBurst) {
      if (current.length > 0) runs.push(current)
      current = []
      currentLogin = login
    }
    current.push(commit)
    lastTime = time
  }
  if (current.length > 0) runs.push(current)

  return runs
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
  const naturalRuns = groupIntoNaturalRuns(sorted)
  if (naturalRuns.length === 0) return []

  const targetBurstCount = Math.min(
    DIRECT_BURST_MAX_TARGET,
    Math.max(DIRECT_BURST_MIN_TARGET, Math.round(sorted.length / DIRECT_BURST_TARGET_DIVISOR)),
  )
  const chunkSize = pickChunkSize(
    naturalRuns.map((run) => run.length),
    targetBurstCount,
  )

  const bursts: DirectCommitBurst[] = []
  for (const run of naturalRuns) {
    for (const part of chunk(run, chunkSize)) bursts.push(makeBurst(part))
  }
  return bursts
}
