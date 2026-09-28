import type { MergedPullRequest, RepoSnapshot } from '../repo'
import type { TimeBounds } from './types'

export interface EraDraft {
  startTime: number
  endTime: number
  mergedPrs: MergedPullRequest[]
}

export interface EraOptions {
  /** Cap on the number of eras (limbs), after merging. */
  maxEras: number
  /** Eras with fewer merged PRs than this get merged into a neighbor. */
  minPrsPerEra: number
}

export const DEFAULT_ERA_OPTIONS: EraOptions = {
  maxEras: 16,
  minPrsPerEra: 3,
}

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

/** Whether the repository has enough releases to derive eras from them directly. */
export function hasEnoughReleasesForEras(snapshot: RepoSnapshot): boolean {
  return snapshot.releases.length >= 2
}

function releaseBoundaries(snapshot: RepoSnapshot, bounds: TimeBounds): number[] {
  const releaseTimes = snapshot.releases
    .map((release) => toEpochMs(release.date))
    .filter((time) => Number.isFinite(time) && time > 0)
    .sort((a, b) => a - b)

  return dedupeAscending([bounds.firstEventTime, ...releaseTimes, bounds.lastEventTime])
}

/** Calendar-quarter boundaries spanning the full history, used when releases can't drive eras. */
function quarterBoundaries(bounds: TimeBounds): number[] {
  const start = new Date(bounds.firstEventTime)
  let year = start.getUTCFullYear()
  let quarter = Math.floor(start.getUTCMonth() / 3)

  const boundaries: number[] = [bounds.firstEventTime]
  // Safety cap: at most ~200 quarters (50 years) so a bad timestamp can't loop forever.
  for (let guard = 0; guard < 200; guard++) {
    quarter += 1
    if (quarter > 3) {
      quarter = 0
      year += 1
    }
    const boundaryTime = Date.UTC(year, quarter * 3, 1)
    if (boundaryTime >= bounds.lastEventTime) break
    boundaries.push(boundaryTime)
  }
  boundaries.push(bounds.lastEventTime)
  return dedupeAscending(boundaries)
}

function dedupeAscending(times: number[]): number[] {
  const sorted = [...times].sort((a, b) => a - b)
  const deduped: number[] = []
  for (const time of sorted) {
    const last = deduped[deduped.length - 1]
    if (last === undefined || time > last) deduped.push(time)
  }
  if (deduped.length < 2) {
    const only = deduped[0] ?? 0
    return [only, only + 1]
  }
  return deduped
}

function findEraIndex(eras: EraDraft[], time: number): number {
  if (time <= eras[0]!.startTime) return 0
  for (let i = 0; i < eras.length; i++) {
    if (time < eras[i]!.endTime) return i
  }
  return eras.length - 1
}

function draftsFromBoundaries(boundaries: number[], mergedPrs: MergedPullRequest[]): EraDraft[] {
  const eras: EraDraft[] = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    eras.push({ startTime: boundaries[i]!, endTime: boundaries[i + 1]!, mergedPrs: [] })
  }

  for (const pr of mergedPrs) {
    const mergedAt = toEpochMs(pr.mergedAt)
    eras[findEraIndex(eras, mergedAt)]!.mergedPrs.push(pr)
  }
  return eras
}

/**
 * Repeatedly merges the era with the fewest merged PRs into its nearest
 * neighbor until the era count is within `maxEras` and every remaining era
 * (bar a single leftover) has at least `minPrsPerEra` merged PRs. Guaranteed
 * to terminate: each iteration strictly reduces the era count.
 */
function mergeSmallEras(eras: EraDraft[], options: EraOptions): EraDraft[] {
  let result = eras

  while (
    result.length > 1 &&
    (result.length > options.maxEras || result.some((era) => era.mergedPrs.length < options.minPrsPerEra))
  ) {
    let smallestIndex = 0
    for (let i = 1; i < result.length; i++) {
      if (result[i]!.mergedPrs.length < result[smallestIndex]!.mergedPrs.length) smallestIndex = i
    }

    const mergeWithNext = smallestIndex < result.length - 1
    const otherIndex = mergeWithNext ? smallestIndex + 1 : smallestIndex - 1
    const leftIndex = mergeWithNext ? smallestIndex : otherIndex
    const rightIndex = mergeWithNext ? otherIndex : smallestIndex

    const left = result[leftIndex]!
    const right = result[rightIndex]!
    const merged: EraDraft = {
      startTime: left.startTime,
      endTime: right.endTime,
      mergedPrs: [...left.mergedPrs, ...right.mergedPrs],
    }

    result = [...result.slice(0, leftIndex), merged, ...result.slice(rightIndex + 1)]
  }

  return result
}

/**
 * Splits the repository's merged-PR history into eras (chronological
 * intervals), which become the tree's main limbs. Uses release dates as
 * boundaries when there are at least two releases, otherwise falls back to
 * calendar quarters. Tiny eras are merged into neighbors and the total is
 * capped, so trees never grow more limbs than look good.
 */
export function buildEras(
  snapshot: RepoSnapshot,
  bounds: TimeBounds,
  options: EraOptions = DEFAULT_ERA_OPTIONS,
): EraDraft[] {
  const boundaries = hasEnoughReleasesForEras(snapshot)
    ? releaseBoundaries(snapshot, bounds)
    : quarterBoundaries(bounds)

  const drafts = draftsFromBoundaries(boundaries, snapshot.mergedPullRequests)
  return mergeSmallEras(drafts, options)
}
