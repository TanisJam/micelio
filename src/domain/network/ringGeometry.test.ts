import { describe, expect, it } from 'vitest'
import { capEvenly, discRadius, DISC_MAX_RADIUS, pointOnHyphaAtRadius, radiusForCommitCount, radiusForFrac, timeToFrac } from './ringGeometry'

describe('radiusForFrac / timeToFrac', () => {
  it('radiusForFrac is 0 at frac 0 and monotonically increasing to frac 1', () => {
    expect(radiusForFrac(0)).toBe(0)
    let previous = 0
    for (let f = 0.1; f <= 1; f += 0.1) {
      const r = radiusForFrac(f)
      expect(r).toBeGreaterThan(previous)
      previous = r
    }
  })

  it('never exceeds DISC_MAX_RADIUS', () => {
    expect(radiusForFrac(1)).toBeCloseTo(DISC_MAX_RADIUS, 6)
    expect(radiusForFrac(1.5)).toBeCloseTo(DISC_MAX_RADIUS, 6) // clamped
  })

  it('timeToFrac clamps to [0, 1] and handles a zero-span bounds without dividing by zero', () => {
    const bounds = { firstEventTime: 100, lastEventTime: 100 }
    expect(timeToFrac(50, bounds)).toBe(0)
    expect(timeToFrac(200, bounds)).toBe(0)
    expect(Number.isFinite(timeToFrac(100, bounds))).toBe(true)
  })

  it('timeToFrac is 0 at the start and 1 at the end of a real span', () => {
    const bounds = { firstEventTime: 0, lastEventTime: 1000 }
    expect(timeToFrac(0, bounds)).toBe(0)
    expect(timeToFrac(1000, bounds)).toBe(1)
    expect(timeToFrac(500, bounds)).toBeCloseTo(0.5, 6)
  })
})

describe('discRadius', () => {
  it('ignores y and measures XZ distance from the origin', () => {
    expect(discRadius({ x: 3, y: 999, z: 4 })).toBeCloseTo(5, 6)
    expect(discRadius({ x: 0, y: 0, z: 0 })).toBe(0)
  })
})

describe('radiusForCommitCount', () => {
  it('is monotonically non-decreasing with commit count', () => {
    let previous = -Infinity
    for (const count of [0, 1, 5, 20, 80, 200, 1000]) {
      const r = radiusForCommitCount(count)
      expect(r).toBeGreaterThanOrEqual(previous)
      previous = r
    }
  })
})

describe('pointOnHyphaAtRadius', () => {
  const points = [
    { position: { x: 1, y: 0, z: 0 }, radius: 0.02, time: 0 },
    { position: { x: 10, y: 0, z: 0 }, radius: 0.01, time: 100 },
  ]

  it('interpolates position along the polyline at an interior radius', () => {
    const at = pointOnHyphaAtRadius(points, 5.5)
    expect(at.position.x).toBeCloseTo(5.5, 6)
    expect(at.radius).toBeCloseTo(5.5, 6)
  })

  it('clamps a radius outside the hypha`s own span to the nearest end, never extrapolating', () => {
    expect(pointOnHyphaAtRadius(points, -10).position.x).toBeCloseTo(1, 6)
    expect(pointOnHyphaAtRadius(points, 1000).position.x).toBeCloseTo(10, 6)
  })

  it('never returns NaN/Infinity for a single-point hypha', () => {
    const at = pointOnHyphaAtRadius([points[0]!], 5)
    expect(Number.isFinite(at.position.x)).toBe(true)
    expect(Number.isFinite(at.radius)).toBe(true)
  })
})

describe('capEvenly', () => {
  it('keeps everything and reports no overflow when under the cap', () => {
    const { kept, omitted } = capEvenly([1, 2, 3], 10)
    expect(kept).toEqual([1, 2, 3])
    expect(omitted).toBe(0)
  })

  it('always keeps the first and last item, and reports the honest overflow count', () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    const { kept, omitted } = capEvenly(items, 10)
    expect(kept[0]).toBe(0)
    expect(kept[kept.length - 1]).toBe(99)
    expect(kept.length).toBe(10)
    expect(omitted).toBe(90)
  })
})
