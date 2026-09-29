import { describe, expect, it } from 'vitest'
import { conduitSplitRadius, formatOverflowNote, isGrown, RECENT_GROWTH_FRACTION, recentGrowthFactor, rimAgeStyle } from './renderHints'
import { radiusForFrac, timeToFrac } from './ringGeometry'
import type { Hypha } from './types'

const bounds = { firstEventTime: 0, lastEventTime: 1_000_000 }

function makeHypha(overrides: Partial<Hypha>): Hypha {
  return {
    id: 'hypha-pr1',
    kind: 'merged',
    ref: { type: 'pull_request', id: '1' },
    time: 0,
    parentHyphaId: null,
    splitTime: 0,
    endTime: 100,
    status: 'fused',
    points: [],
    lane: 0,
    side: 0,
    commitCount: 1,
    attachment: null,
    ...overrides,
  }
}

describe('conduitSplitRadius', () => {
  it('returns null for a non-colony attachment', () => {
    const hypha = makeHypha({
      attachment: 'parent-branch',
      splitTime: 500_000,
      points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 500_000 }],
    })
    expect(conduitSplitRadius(hypha, bounds)).toBeNull()
  })

  it('returns null when the hypha does not actually start at the spore', () => {
    const hypha = makeHypha({
      attachment: 'colony',
      splitTime: 500_000,
      points: [{ position: { x: 1, y: 0, z: 0 }, radius: 0.01, time: 500_000 }],
    })
    expect(conduitSplitRadius(hypha, bounds)).toBeNull()
  })

  it('returns null when splitTime is effectively the beginning (no honesty gap)', () => {
    const hypha = makeHypha({
      attachment: 'colony',
      splitTime: 0,
      points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 0 }],
    })
    expect(conduitSplitRadius(hypha, bounds)).toBeNull()
  })

  it('returns the real split-time radius for a spore-started colony hypha with a late split time', () => {
    const splitTime = 500_000
    const hypha = makeHypha({
      attachment: 'colony',
      splitTime,
      points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: splitTime }],
    })
    const expected = radiusForFrac(timeToFrac(splitTime, bounds))
    expect(conduitSplitRadius(hypha, bounds)).toBeCloseTo(expected, 9)
    expect(conduitSplitRadius(hypha, bounds)).toBeGreaterThan(0)
  })

  it('never returns NaN/Infinity for degenerate bounds', () => {
    const hypha = makeHypha({
      attachment: 'colony',
      splitTime: 5,
      points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 5 }],
    })
    const degenerate = { firstEventTime: 5, lastEventTime: 5 }
    const result = conduitSplitRadius(hypha, degenerate)
    expect(result === null || Number.isFinite(result)).toBe(true)
  })
})

describe('isGrown', () => {
  it('is true once currentTime reaches birthTime', () => {
    expect(isGrown(100, 100)).toBe(true)
    expect(isGrown(100, 101)).toBe(true)
  })

  it('is false before birthTime', () => {
    expect(isGrown(100, 99)).toBe(false)
  })
})

describe('recentGrowthFactor', () => {
  it('is exactly 0 for every time at or before the recent-slice boundary', () => {
    const sliceStartFrac = 1 - RECENT_GROWTH_FRACTION
    const sliceStartTime = bounds.firstEventTime + sliceStartFrac * (bounds.lastEventTime - bounds.firstEventTime)
    expect(recentGrowthFactor(bounds.firstEventTime, bounds)).toBe(0)
    expect(recentGrowthFactor(sliceStartTime, bounds)).toBe(0)
    expect(recentGrowthFactor(sliceStartTime - 1, bounds)).toBe(0)
  })

  it('is 1 (within floating-point precision) at the very last event time', () => {
    expect(recentGrowthFactor(bounds.lastEventTime, bounds)).toBeCloseTo(1, 9)
  })

  it('is monotonically non-decreasing across the recent slice', () => {
    const sliceStartFrac = 1 - RECENT_GROWTH_FRACTION
    const span = bounds.lastEventTime - bounds.firstEventTime
    let previous = -1
    for (let frac = sliceStartFrac; frac <= 1; frac += 0.01) {
      const time = bounds.firstEventTime + frac * span
      const value = recentGrowthFactor(time, bounds)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('stays within [0, 1] and never NaN for degenerate (zero-span) bounds', () => {
    const degenerate = { firstEventTime: 10, lastEventTime: 10 }
    const value = recentGrowthFactor(10, degenerate)
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(1)
  })

  it('is eased (quadratic), not linear -- halfway through the slice reads well under half the effect', () => {
    const sliceStartFrac = 1 - RECENT_GROWTH_FRACTION
    const span = bounds.lastEventTime - bounds.firstEventTime
    const midTime = bounds.firstEventTime + (sliceStartFrac + RECENT_GROWTH_FRACTION / 2) * span
    expect(recentGrowthFactor(midTime, bounds)).toBeCloseTo(0.25, 6)
  })
})

describe('rimAgeStyle', () => {
  it('is a no-op (scale 1, no cool blend) for a hypha well outside the recent slice', () => {
    const style = rimAgeStyle(bounds.firstEventTime, bounds)
    expect(style.recency).toBe(0)
    expect(style.widthScale).toBe(1)
    expect(style.alphaScale).toBe(1)
    expect(style.coolBlend).toBe(0)
  })

  it('thins, dims, and cools the most recent hypha, but never to zero/invisible', () => {
    const style = rimAgeStyle(bounds.lastEventTime, bounds)
    expect(style.recency).toBeCloseTo(1, 9)
    expect(style.widthScale).toBeGreaterThan(0)
    expect(style.widthScale).toBeLessThan(1)
    expect(style.alphaScale).toBeGreaterThan(0)
    expect(style.alphaScale).toBeLessThan(1)
    expect(style.coolBlend).toBeGreaterThan(0)
    expect(style.coolBlend).toBeLessThan(1) // partial blend: still carries its own kind color
  })

  it('is monotonic: a strictly more recent split time never renders wider/brighter/less cool than an older one', () => {
    const span = bounds.lastEventTime - bounds.firstEventTime
    const sliceStartFrac = 1 - RECENT_GROWTH_FRACTION
    let previous = rimAgeStyle(bounds.firstEventTime + sliceStartFrac * span, bounds)
    for (let frac = sliceStartFrac; frac <= 1; frac += 0.02) {
      const style = rimAgeStyle(bounds.firstEventTime + frac * span, bounds)
      expect(style.widthScale).toBeLessThanOrEqual(previous.widthScale + 1e-9)
      expect(style.alphaScale).toBeLessThanOrEqual(previous.alphaScale + 1e-9)
      expect(style.coolBlend).toBeGreaterThanOrEqual(previous.coolBlend - 1e-9)
      previous = style
    }
  })

  it('never returns NaN/Infinity for degenerate (zero-span) bounds', () => {
    const degenerate = { firstEventTime: 5, lastEventTime: 5 }
    const style = rimAgeStyle(5, degenerate)
    expect(Number.isFinite(style.widthScale)).toBe(true)
    expect(Number.isFinite(style.alphaScale)).toBe(true)
    expect(Number.isFinite(style.coolBlend)).toBe(true)
  })
})

describe('formatOverflowNote', () => {
  it('returns null when nothing was omitted', () => {
    expect(formatOverflowNote(0)).toBeNull()
  })

  it('returns null for a negative count (defensive, should never happen)', () => {
    expect(formatOverflowNote(-1)).toBeNull()
  })

  it('singularizes exactly one omitted pull request', () => {
    expect(formatOverflowNote(1)).toBe('+1 pull request not drawn')
  })

  it('pluralizes more than one omitted pull request', () => {
    expect(formatOverflowNote(42)).toBe('+42 pull requests not drawn')
  })
})
