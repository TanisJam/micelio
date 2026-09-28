import { describe, expect, it } from 'vitest'
import { clamp, easeInOutCubic, easeOutCubic, lerp, logScale } from './math.ts'

describe('clamp', () => {
  it('keeps values inside the range unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps values below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps values above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('throws when min > max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError)
  })
})

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(2, 8, 0)).toBe(2)
    expect(lerp(2, 8, 1)).toBe(8)
  })

  it('interpolates linearly in between', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})

describe('logScale', () => {
  it('maps the minimum to 0 and the maximum to 1', () => {
    expect(logScale(1, 1, 100)).toBeCloseTo(0)
    expect(logScale(100, 1, 100)).toBeCloseTo(1)
  })

  it('never returns NaN for degenerate ranges', () => {
    expect(logScale(5, 5, 5)).toBe(0)
  })

  it('is monotonic increasing', () => {
    const a = logScale(10, 1, 1000)
    const b = logScale(500, 1, 1000)
    expect(b).toBeGreaterThan(a)
  })
})

describe('easeOutCubic', () => {
  it('is 0 at t=0 and 1 at t=1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('clamps outside [0, 1]', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('is monotonic non-decreasing', () => {
    let previous = 0
    for (let t = 0; t <= 1; t += 0.1) {
      const value = easeOutCubic(t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('easeInOutCubic', () => {
  it('is 0 at t=0, 0.5 at t=0.5 and 1 at t=1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('clamps outside [0, 1]', () => {
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })

  it('is monotonic non-decreasing', () => {
    let previous = 0
    for (let t = 0; t <= 1; t += 0.1) {
      const value = easeInOutCubic(t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})
