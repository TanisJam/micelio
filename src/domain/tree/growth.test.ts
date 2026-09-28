import { describe, expect, it } from 'vitest'
import {
  easePlaybackProgress,
  limbGrowthProgress,
  mapPlaybackProgressToTime,
  popScale,
  trunkGrowthProgress,
  twigGrowthProgress,
} from './growth'
import type { Limb, TimeBounds, Twig } from './types'

const bounds: TimeBounds = { firstEventTime: 1_000, lastEventTime: 11_000 }

function makeTrunk(times: number[]) {
  return { segments: times.map((time) => ({ time })) }
}

describe('trunkGrowthProgress', () => {
  const trunk = makeTrunk([1_000, 3_000, 6_000, 11_000])

  it('is 0 before the first segment and 1 at/after the last', () => {
    expect(trunkGrowthProgress(trunk, 0)).toBe(0)
    expect(trunkGrowthProgress(trunk, 1_000)).toBe(0)
    expect(trunkGrowthProgress(trunk, 11_000)).toBe(1)
    expect(trunkGrowthProgress(trunk, 999_999)).toBe(1)
  })

  it('is monotonic non-decreasing over time', () => {
    let previous = -Infinity
    for (let t = 0; t <= 12_000; t += 500) {
      const value = trunkGrowthProgress(trunk, t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('handles a single-segment trunk without dividing by zero', () => {
    const single = makeTrunk([5_000])
    expect(trunkGrowthProgress(single, 0)).toBe(0)
    expect(trunkGrowthProgress(single, 5_000)).toBe(1)
  })

  it('handles an empty trunk as fully grown', () => {
    expect(trunkGrowthProgress(makeTrunk([]), 0)).toBe(1)
  })
})

describe('limbGrowthProgress', () => {
  const limb: Limb = {
    id: 'limb-0',
    kind: 'limb',
    time: 2_000,
    ref: { type: 'era', id: 'era-0' },
    eraIndex: 0,
    points: [],
    activity: 2,
    overflowPrCount: 0,
  }
  const twigs: Twig[] = [
    { id: 't1', kind: 'twig', time: 3_000, ref: { type: 'pull_request', id: '1' }, limbId: 'limb-0', points: [], side: 1 },
    { id: 't2', kind: 'twig', time: 5_000, ref: { type: 'pull_request', id: '2' }, limbId: 'limb-0', points: [], side: -1 },
  ]

  it('is 0 before the limb starts and 1 once its last twig has landed', () => {
    expect(limbGrowthProgress(limb, twigs, bounds, 1_000)).toBe(0)
    expect(limbGrowthProgress(limb, twigs, bounds, 5_000)).toBe(1)
    expect(limbGrowthProgress(limb, twigs, bounds, 9_000)).toBe(1)
  })

  it('is monotonic non-decreasing over time', () => {
    let previous = -Infinity
    for (let t = 0; t <= 6_000; t += 250) {
      const value = limbGrowthProgress(limb, twigs, bounds, t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('still reaches 1 for a limb with no twigs', () => {
    const bare: Limb = { ...limb, id: 'limb-1' }
    expect(limbGrowthProgress(bare, [], bounds, bounds.lastEventTime)).toBe(1)
    expect(limbGrowthProgress(bare, [], bounds, bare.time)).toBe(0)
  })

  it('never falls behind an already-sprouted twig (regression: unevenly-timed merges within an era)', () => {
    // Twigs are positioned along the limb by index (index / (count - 1)),
    // which always matches merge-time order. Even with very unevenly spaced
    // merge times, the limb's drawn length must cover every popped twig's
    // position -- otherwise that twig (and its leaves) would render past
    // the limb's currently-visible tip.
    const burstyTwigs: Twig[] = [
      { id: 't1', kind: 'twig', time: 2_001, ref: { type: 'pull_request', id: '1' }, limbId: 'limb-0', points: [], side: 1 },
      { id: 't2', kind: 'twig', time: 2_002, ref: { type: 'pull_request', id: '2' }, limbId: 'limb-0', points: [], side: -1 },
      { id: 't3', kind: 'twig', time: 2_003, ref: { type: 'pull_request', id: '3' }, limbId: 'limb-0', points: [], side: 1 },
      { id: 't4', kind: 'twig', time: 10_000, ref: { type: 'pull_request', id: '4' }, limbId: 'limb-0', points: [], side: -1 },
    ]

    for (let index = 0; index < burstyTwigs.length; index++) {
      const twig = burstyTwigs[index]!
      const twigPosition = index / (burstyTwigs.length - 1)
      const progress = limbGrowthProgress(limb, burstyTwigs, bounds, twig.time)
      expect(progress).toBeGreaterThanOrEqual(twigPosition)
    }
  })
})

describe('twigGrowthProgress', () => {
  const twig = { time: 5_000 }

  it('is 0 before birth and 1 well after', () => {
    expect(twigGrowthProgress(twig, bounds, 0)).toBe(0)
    expect(twigGrowthProgress(twig, bounds, 5_000)).toBe(0)
    expect(twigGrowthProgress(twig, bounds, bounds.lastEventTime)).toBe(1)
  })

  it('is monotonic non-decreasing', () => {
    let previous = -Infinity
    for (let t = 4_000; t <= 6_500; t += 50) {
      const value = twigGrowthProgress(twig, bounds, t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('popScale', () => {
  it('is 0 before the element time and reaches 1', () => {
    expect(popScale(5_000, bounds, 4_999)).toBe(0)
    expect(popScale(5_000, bounds, bounds.lastEventTime)).toBe(1)
  })

  it('is monotonic non-decreasing', () => {
    let previous = -Infinity
    for (let t = 4_500; t <= 6_000; t += 50) {
      const value = popScale(5_000, bounds, t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('mapPlaybackProgressToTime', () => {
  it('is exact at both ends and clamped outside [0, 1]', () => {
    expect(mapPlaybackProgressToTime(0, bounds)).toBe(bounds.firstEventTime)
    expect(mapPlaybackProgressToTime(1, bounds)).toBe(bounds.lastEventTime)
    expect(mapPlaybackProgressToTime(-1, bounds)).toBe(bounds.firstEventTime)
    expect(mapPlaybackProgressToTime(2, bounds)).toBe(bounds.lastEventTime)
  })

  it('is monotonic non-decreasing', () => {
    let previous = -Infinity
    for (let p = 0; p <= 1; p += 0.05) {
      const value = mapPlaybackProgressToTime(p, bounds)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('easePlaybackProgress', () => {
  it('is 0 at 0 and 1 at 1', () => {
    expect(easePlaybackProgress(0)).toBe(0)
    expect(easePlaybackProgress(1)).toBe(1)
  })
})
