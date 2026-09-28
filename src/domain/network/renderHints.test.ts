import { describe, expect, it } from 'vitest'
import { conduitSplitRadius, formatOverflowNote, isGrown } from './renderHints'
import { radiusForFrac, timeToFrac } from './layout'
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
