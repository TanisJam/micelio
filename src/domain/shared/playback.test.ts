import { describe, expect, it } from 'vitest'
import { easePlaybackProgress, mapPlaybackProgressToTime } from './playback'
import type { TimeBounds } from './types'

const bounds: TimeBounds = { firstEventTime: 1_000, lastEventTime: 11_000 }

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
