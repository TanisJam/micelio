import type { RepoSnapshot } from '../repo'
import type { TimeBounds } from './types'

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Computes the first and last event time across every dated element in the
 * snapshot. Used to place the colony's radial growth and to drive the
 * growth-replay scrubber.
 */
export function computeTimeBounds(snapshot: RepoSnapshot): TimeBounds {
  const times: number[] = [toEpochMs(snapshot.meta.createdAt), toEpochMs(snapshot.meta.pushedAt)]

  for (const release of snapshot.releases) times.push(toEpochMs(release.date))
  for (const pr of snapshot.mergedPullRequests) {
    times.push(toEpochMs(pr.createdAt), toEpochMs(pr.mergedAt))
    for (const commit of pr.commits) times.push(toEpochMs(commit.authoredDate))
  }
  for (const pr of snapshot.openPullRequests) times.push(toEpochMs(pr.createdAt))
  for (const branch of snapshot.liveBranches) times.push(toEpochMs(branch.lastCommitDate))
  for (const commit of snapshot.directCommits) times.push(toEpochMs(commit.authoredDate))

  // `fetchedAt` anchors "now" even if pushedAt/releases are all in the past.
  times.push(toEpochMs(snapshot.fetchedAt))

  const finiteTimes = times.filter((t) => Number.isFinite(t) && t > 0)
  if (finiteTimes.length === 0) {
    const now = toEpochMs(snapshot.fetchedAt) || Date.now()
    return { firstEventTime: now, lastEventTime: now }
  }

  const firstEventTime = Math.min(...finiteTimes)
  const lastEventTime = Math.max(...finiteTimes, firstEventTime)
  return { firstEventTime, lastEventTime }
}
