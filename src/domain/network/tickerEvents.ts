/**
 * Unit 4 ("replay history event by event"): a short, honest, real-data
 * ticker line ("#65 merged pull request · Add proxyMap · 12 commits", "12
 * commits pushed to main", "v1.2.0 released") plus running counters (pull
 * requests / commits / releases so far), both driven by the SAME
 * `currentTime` the 3D scene's own growth reveal already reads -- so the
 * ticker and the visible colony always agree on "what has happened so
 * far". Pure -- no React, no three.js.
 */
import { summarizeElementDetail, type PullRequestDetail } from '../elementDetail'
import type { RepoSnapshot } from '../repo'
import { resolveNetworkElementDetail } from './elementDetail'
import type { HyphaKind, NetworkModel } from './types'

/**
 * Post-final-pass (misleading counters): the kinds of hypha that are a REAL
 * pull request -- excludes `direct` (a burst of commits pushed straight to
 * the default branch, no PR involved) and `liveBranch` (a branch with no PR
 * at all). Production feedback: `TanisJam/lime`'s counter read "12 pull
 * requests" for a repo with exactly 1 real PR, because every non-main
 * hypha's own split time (direct bursts and live branches included) was
 * being counted toward "pull requests".
 */
const REAL_PULL_REQUEST_KINDS: ReadonlySet<HyphaKind> = new Set<HyphaKind>(['merged', 'closed', 'open'])

export interface TickerEvent {
  time: number
  text: string
}

function pullRequestEventText(detail: PullRequestDetail): string {
  const verb = detail.status === 'merged' ? 'merged' : detail.status === 'closed' ? 'closed' : 'opened'
  const count = detail.commitCount ?? detail.commits.length
  const commitsPart = count > 0 ? ` · ${count} commit${count === 1 ? '' : 's'}` : ''
  return `#${detail.number} ${verb} · ${detail.title}${commitsPart}`
}

/**
 * One event per landed hypha (merged/closed/fused PR or direct-commit
 * burst, at its own end time) and one per release, sorted ascending. Open
 * PRs and live branches produce no discrete "landed" event of their own
 * (they're still growing) -- their creation is honestly reflected only in
 * the running `pullRequests` counter below, not a one-line ticker moment.
 */
export function buildTickerEvents(model: NetworkModel, snapshot: RepoSnapshot): TickerEvent[] {
  const events: TickerEvent[] = []

  for (const hypha of model.hyphae) {
    if (hypha.kind === 'main' || hypha.status === 'open') continue
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    if (!detail) continue
    if (detail.kind === 'pull_request') {
      events.push({ time: detail.date, text: pullRequestEventText(detail) })
    } else if (detail.kind === 'direct_burst') {
      const count = detail.commitCount
      events.push({ time: detail.lastDate, text: `${count} commit${count === 1 ? '' : 's'} pushed to ${detail.defaultBranch}` })
    }
  }

  for (const mushroom of model.mushrooms) {
    const detail = resolveNetworkElementDetail(model, snapshot, mushroom.id)
    if (detail?.kind === 'release') {
      const summary = summarizeElementDetail(detail)
      events.push({ time: summary.date ?? mushroom.time, text: `${detail.name} released` })
    }
  }

  return events.sort((a, b) => a.time - b.time)
}

export interface TickerCounts {
  pullRequests: number
  commits: number
  releases: number
}

export interface TickerData {
  /** Ascending by time. */
  events: TickerEvent[]
  /** `events.map(e => e.time)`, precomputed once -- avoids a per-frame allocation in `currentTickerEvent`. */
  eventTimes: number[]
  /** Ascending. Every REAL pull-request hypha's own split time -- `merged`/`closed`/`open` only, never a `direct` burst or a PR-less `liveBranch` (see `REAL_PULL_REQUEST_KINDS`). */
  pullRequestTimes: number[]
  /** Ascending. Every rendered commit node's own time -- PR commits and direct-push commits alike (both are real commits). */
  commitTimes: number[]
  /** Ascending. Every mushroom's own time. */
  releaseTimes: number[]
}

export function buildTickerData(model: NetworkModel, snapshot: RepoSnapshot): TickerData {
  const pullRequestTimes = model.hyphae
    .filter((h) => REAL_PULL_REQUEST_KINDS.has(h.kind))
    .map((h) => h.splitTime)
    .sort((a, b) => a - b)
  const commitTimes = model.nodes.map((n) => n.time).sort((a, b) => a - b)
  const releaseTimes = model.mushrooms.map((m) => m.time).sort((a, b) => a - b)
  const events = buildTickerEvents(model, snapshot)

  return { events, eventTimes: events.map((e) => e.time), pullRequestTimes, commitTimes, releaseTimes }
}

/** Count of ascending `times` that are `<= currentTime` -- binary search, cheap enough to call every animation frame. */
function countUpTo(times: number[], currentTime: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid]! <= currentTime) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function tickerCountsAt(data: TickerData, currentTime: number): TickerCounts {
  return {
    pullRequests: countUpTo(data.pullRequestTimes, currentTime),
    commits: countUpTo(data.commitTimes, currentTime),
    releases: countUpTo(data.releaseTimes, currentTime),
  }
}

/** The most recent (latest-time) event at or before `currentTime`, or `null` if none has happened yet. `data.events`/`data.eventTimes` must be ascending (as `buildTickerData` returns). */
export function currentTickerEvent(data: TickerData, currentTime: number): TickerEvent | null {
  const index = countUpTo(data.eventTimes, currentTime)
  return index > 0 ? data.events[index - 1]! : null
}
