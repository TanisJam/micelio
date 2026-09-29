import { describe, expect, it } from 'vitest'
import { makeDirectCommit, makeMergedPr, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import {
  collectActivityEventTimes,
  DEFAULT_LINEAR_BLEND_FRACTION,
  eventPacedTimeAtProgress,
  mapProgressToEventPacedTime,
  sortedActivityEventTimes,
} from './eventPacing'

describe('eventPacedTimeAtProgress', () => {
  const times = [0, 10, 100, 105, 1000]

  it('is exact at both endpoints', () => {
    expect(eventPacedTimeAtProgress(times, 0)).toBe(0)
    expect(eventPacedTimeAtProgress(times, 1)).toBe(1000)
  })

  it('is monotonically non-decreasing across the full 0..1 range', () => {
    let previous = -Infinity
    for (let p = 0; p <= 1; p += 0.01) {
      const t = eventPacedTimeAtProgress(times, p)!
      expect(t).toBeGreaterThanOrEqual(previous)
      previous = t
    }
  })

  it('gives every one of N events a real, non-zero minimum progress-space share (1/(N-1))', () => {
    // Sample the progress axis densely and record the progress value at
    // which the result first reaches (or passes) each event's own time --
    // adjacent events must be separated by at least 1/(N-1) of progress.
    const n = times.length
    const minShare = 1 / (n - 1)
    const reachedAt: number[] = []
    for (const eventTime of times) {
      let p = 0
      while (p <= 1 && eventPacedTimeAtProgress(times, p)! < eventTime) p += 0.0005
      reachedAt.push(p)
    }
    for (let i = 1; i < reachedAt.length; i++) {
      expect(reachedAt[i]! - reachedAt[i - 1]!).toBeGreaterThanOrEqual(minShare - 0.01)
    }
  })

  it('clamps progress outside [0, 1]', () => {
    expect(eventPacedTimeAtProgress(times, -1)).toBe(0)
    expect(eventPacedTimeAtProgress(times, 2)).toBe(1000)
  })

  it('returns the single time for a one-event list, regardless of progress', () => {
    expect(eventPacedTimeAtProgress([42], 0)).toBe(42)
    expect(eventPacedTimeAtProgress([42], 0.5)).toBe(42)
    expect(eventPacedTimeAtProgress([42], 1)).toBe(42)
  })

  it('returns null for an empty list', () => {
    expect(eventPacedTimeAtProgress([], 0.5)).toBeNull()
  })

  it('never returns NaN/Infinity for a real event list', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      expect(Number.isFinite(eventPacedTimeAtProgress(times, p))).toBe(true)
    }
  })
})

describe('mapProgressToEventPacedTime', () => {
  const bounds = { firstEventTime: 0, lastEventTime: 1000 }
  const times = [0, 10, 100, 105, 1000]

  it('is exact at both endpoints', () => {
    expect(mapProgressToEventPacedTime(times, bounds, 0)).toBe(0)
    expect(mapProgressToEventPacedTime(times, bounds, 1)).toBe(1000)
  })

  it('is monotonically non-decreasing across the full 0..1 range for any blend fraction', () => {
    for (const blend of [0, DEFAULT_LINEAR_BLEND_FRACTION, 0.5, 1]) {
      let previous = -Infinity
      for (let p = 0; p <= 1; p += 0.02) {
        const t = mapProgressToEventPacedTime(times, bounds, p, blend)
        expect(t).toBeGreaterThanOrEqual(previous)
        previous = t
      }
    }
  })

  it('stays within bounds for every progress value', () => {
    for (let p = -0.5; p <= 1.5; p += 0.1) {
      const t = mapProgressToEventPacedTime(times, bounds, p)
      expect(t).toBeGreaterThanOrEqual(bounds.firstEventTime)
      expect(t).toBeLessThanOrEqual(bounds.lastEventTime)
    }
  })

  it('falls back to pure linear time when there are no events at all', () => {
    expect(mapProgressToEventPacedTime([], bounds, 0.5)).toBe(500)
  })

  it('blend=1 matches pure linear time exactly', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const expected = bounds.firstEventTime + p * (bounds.lastEventTime - bounds.firstEventTime)
      expect(mapProgressToEventPacedTime(times, bounds, p, 1)).toBeCloseTo(expected, 6)
    }
  })

  it('a small blend still keeps the result close to the event-paced value, not the linear one', () => {
    // Progress 0.5 sits between the 3rd (100) and 4th (105) of 5 events --
    // event-paced time here is close to 100-105, far from the linear
    // midpoint (500).
    const t = mapProgressToEventPacedTime(times, bounds, 0.5, 0.1)
    expect(t).toBeLessThan(250)
  })
})

describe('collectActivityEventTimes / sortedActivityEventTimes', () => {
  it('collects hypha split/end times, commit node times and mushroom times from a real model', () => {
    const merged = makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'a', createdAt: '2021-01-01T00:00:00Z', mergedAt: '2021-02-01T00:00:00Z' })
    const snapshot = makeSnapshot({ mergedPullRequests: [merged], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [] })
    const model = buildNetwork(snapshot)
    const times = collectActivityEventTimes(model)
    expect(times.length).toBeGreaterThan(0)
    for (const t of times) expect(Number.isFinite(t)).toBe(true)
  })

  it('counts exactly one split (and, for non-open hyphae, one end) event per non-main hypha, plus every commit node and mushroom', () => {
    const model = buildNetwork(makeSnapshot())
    const nonMainHyphae = model.hyphae.filter((h) => h.kind !== 'main')
    const expectedHyphaEvents = nonMainHyphae.reduce((sum, h) => sum + (h.status === 'open' ? 1 : 2), 0)
    const expectedCount = expectedHyphaEvents + model.nodes.length + model.mushrooms.length
    expect(collectActivityEventTimes(model)).toHaveLength(expectedCount)
  })

  it('includes direct-commit burst split/end times (Unit 2 + Unit 4)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [makeDirectCommit({ oid: 'd1', authoredDate: '2023-05-01T00:00:00Z' })],
    })
    const model = buildNetwork(snapshot)
    const directHypha = model.hyphae.find((h) => h.kind === 'direct')!
    const times = collectActivityEventTimes(model)
    expect(times).toContain(directHypha.splitTime)
    expect(times).toContain(directHypha.endTime)
  })

  it('sortedActivityEventTimes returns the same set, ascending', () => {
    const model = buildNetwork(makeSnapshot())
    const sorted = sortedActivityEventTimes(model)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!).toBeGreaterThanOrEqual(sorted[i - 1]!)
    expect(sorted.length).toBe(collectActivityEventTimes(model).length)
  })

  it('handles a model with only a spore (no PRs, no direct commits) without throwing', () => {
    const model = buildNetwork(
      makeSnapshot({ mergedPullRequests: [], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [], directCommits: [] }),
    )
    expect(() => sortedActivityEventTimes(model)).not.toThrow()
  })
})
