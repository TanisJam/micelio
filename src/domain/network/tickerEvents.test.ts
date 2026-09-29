import { describe, expect, it } from 'vitest'
import { makeBranch, makeClosedPr, makeDirectCommit, makeMergedPr, makeOpenPr, makeRelease, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import { buildTickerData, buildTickerEvents, currentTickerEvent, tickerCountsAt } from './tickerEvents'

function buildFixtureModel() {
  const snapshot = makeSnapshot({
    mergedPullRequests: [makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'a', createdAt: '2021-01-01T00:00:00Z', mergedAt: '2021-02-01T00:00:00Z' })],
    closedPullRequests: [makeClosedPr({ number: 2, baseRefName: 'main', headRefName: 'b', createdAt: '2021-03-01T00:00:00Z', closedAt: '2021-04-01T00:00:00Z' })],
    openPullRequests: [makeOpenPr({ number: 3, baseRefName: 'main', headRefName: 'c', createdAt: '2021-05-01T00:00:00Z' })],
    liveBranches: [],
    releases: [makeRelease({ tag: 'v1.0.0', date: '2021-06-01T00:00:00Z' })],
    directCommits: [makeDirectCommit({ oid: 'd1', authoredDate: '2021-07-01T00:00:00Z' })],
  })
  return { snapshot, model: buildNetwork(snapshot) }
}

describe('buildTickerEvents', () => {
  it('produces one event for the merged PR, one for the closed PR, one for the direct burst and one for the release', () => {
    const { snapshot, model } = buildFixtureModel()
    const events = buildTickerEvents(model, snapshot)
    expect(events.some((e) => e.text.includes('#1 merged'))).toBe(true)
    expect(events.some((e) => e.text.includes('#2 closed'))).toBe(true)
    expect(events.some((e) => e.text.includes('pushed to'))).toBe(true)
    expect(events.some((e) => e.text.includes('v1.0.0 released'))).toBe(true)
  })

  it('never produces an event for a still-open PR (it has no "landed" moment yet)', () => {
    const { snapshot, model } = buildFixtureModel()
    const events = buildTickerEvents(model, snapshot)
    expect(events.some((e) => e.text.includes('#3'))).toBe(false)
  })

  it('is sorted ascending by time', () => {
    const { snapshot, model } = buildFixtureModel()
    const events = buildTickerEvents(model, snapshot)
    for (let i = 1; i < events.length; i++) expect(events[i]!.time).toBeGreaterThanOrEqual(events[i - 1]!.time)
  })

  it('includes a real commit count in a merged/closed PR event text', () => {
    const { snapshot, model } = buildFixtureModel()
    const events = buildTickerEvents(model, snapshot)
    const mergedEvent = events.find((e) => e.text.includes('#1 merged'))!
    expect(mergedEvent.text).toMatch(/\d+ commits?/)
  })

  it('produces no events for a snapshot with nothing landed yet', () => {
    const snapshot = makeSnapshot({ mergedPullRequests: [], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [], directCommits: [] })
    const model = buildNetwork(snapshot)
    expect(buildTickerEvents(model, snapshot)).toEqual([])
  })
})

describe('tickerCountsAt', () => {
  it('counts nothing before the first event', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    const counts = tickerCountsAt(data, 0)
    expect(counts).toEqual({ pullRequests: 0, commits: 0, releases: 0 })
  })

  it('counts everything at the model\'s own last event time', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    const counts = tickerCountsAt(data, model.bounds.time.lastEventTime)
    expect(counts.pullRequests).toBeGreaterThan(0)
    expect(counts.commits).toBeGreaterThan(0)
    expect(counts.releases).toBe(1)
  })

  /**
   * Post-final-pass (misleading counters): production feedback on
   * `TanisJam/lime` -- "12 pull requests" for a repo with exactly 1 real
   * PR, because a direct-commit burst's and a live branch's own split time
   * were both counted toward "pull requests" too. `buildFixtureModel` has
   * exactly 3 REAL pull requests (1 merged, 1 closed, 1 open) plus 1
   * direct-commit burst; this adds a live branch with no PR at all on top
   * -- the truthful count must stay exactly 3 regardless.
   */
  it('counts only REAL pull requests (merged/closed/open) -- never a direct-commit burst or a PR-less live branch', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'a', createdAt: '2021-01-01T00:00:00Z', mergedAt: '2021-02-01T00:00:00Z' })],
      closedPullRequests: [makeClosedPr({ number: 2, baseRefName: 'main', headRefName: 'b', createdAt: '2021-03-01T00:00:00Z', closedAt: '2021-04-01T00:00:00Z' })],
      openPullRequests: [makeOpenPr({ number: 3, baseRefName: 'main', headRefName: 'c', createdAt: '2021-05-01T00:00:00Z' })],
      liveBranches: [makeBranch({ name: 'feature/loose', lastCommitDate: '2021-08-01T00:00:00Z' })],
      releases: [],
      directCommits: [makeDirectCommit({ oid: 'd1', authoredDate: '2021-07-01T00:00:00Z' })],
    })
    const model = buildNetwork(snapshot)
    const data = buildTickerData(model, snapshot)
    const counts = tickerCountsAt(data, model.bounds.time.lastEventTime)
    expect(counts.pullRequests).toBe(3)
  })

  it('is monotonically non-decreasing as currentTime advances', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    const { firstEventTime, lastEventTime } = model.bounds.time
    let previous = { pullRequests: -1, commits: -1, releases: -1 }
    for (let f = 0; f <= 1; f += 0.05) {
      const t = firstEventTime + f * (lastEventTime - firstEventTime)
      const counts = tickerCountsAt(data, t)
      expect(counts.pullRequests).toBeGreaterThanOrEqual(previous.pullRequests)
      expect(counts.commits).toBeGreaterThanOrEqual(previous.commits)
      expect(counts.releases).toBeGreaterThanOrEqual(previous.releases)
      previous = counts
    }
  })
})

describe('currentTickerEvent', () => {
  it('is null before any event has happened', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    expect(currentTickerEvent(data, data.events[0]!.time - 1)).toBeNull()
  })

  it('returns exactly the event at its own time, and stays that event until the next one', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    const first = data.events[0]!
    expect(currentTickerEvent(data, first.time)?.text).toBe(first.text)
    if (data.events.length > 1) {
      const justBeforeSecond = data.events[1]!.time - 1
      expect(currentTickerEvent(data, justBeforeSecond)?.text).toBe(first.text)
    }
  })

  it('returns the LAST event once currentTime reaches the end', () => {
    const { snapshot, model } = buildFixtureModel()
    const data = buildTickerData(model, snapshot)
    const last = data.events[data.events.length - 1]!
    expect(currentTickerEvent(data, model.bounds.time.lastEventTime)?.text).toBe(last.text)
  })

  it('returns null for a model with no events at all', () => {
    const snapshot = makeSnapshot({ mergedPullRequests: [], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [], directCommits: [] })
    const model = buildNetwork(snapshot)
    const data = buildTickerData(model, snapshot)
    expect(currentTickerEvent(data, model.bounds.time.lastEventTime)).toBeNull()
  })
})
