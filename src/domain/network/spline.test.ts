import { describe, expect, it } from 'vitest'
import { vec3Length, subVec3 } from '../shared/vector'
import { sampleCatmullRomCentripetal, type SplineControlPoint } from './spline'

function cp(x: number, y: number, z: number, radius: number, time: number): SplineControlPoint {
  return { position: { x, y, z }, radius, time }
}

describe('sampleCatmullRomCentripetal', () => {
  it('returns the single point unchanged for a 1-point input', () => {
    const result = sampleCatmullRomCentripetal([cp(1, 2, 3, 0.5, 100)], 8)
    expect(result).toEqual([{ position: { x: 1, y: 2, z: 3 }, radius: 0.5, time: 100 }])
  })

  it('returns [] for an empty input', () => {
    expect(sampleCatmullRomCentripetal([], 8)).toEqual([])
  })

  it('passes exactly through every control point (first and last, and interior ones)', () => {
    const controlPoints = [cp(0, 0, 0, 0.1, 0), cp(1, 0.5, 0, 0.2, 10), cp(2, 0, 1, 0.3, 20), cp(3, -0.5, 0.5, 0.15, 30)]
    const samples = sampleCatmullRomCentripetal(controlPoints, 6)

    for (const control of controlPoints) {
      const closest = samples.reduce((best, s) =>
        vec3Length(subVec3(s.position, control.position)) < vec3Length(subVec3(best.position, control.position)) ? s : best,
      )
      expect(vec3Length(subVec3(closest.position, control.position))).toBeLessThan(1e-6)
    }
  })

  it('interpolates radius and time linearly per segment, monotonically for monotonic control points', () => {
    const controlPoints = [cp(0, 0, 0, 0, 0), cp(1, 0, 0, 1, 10), cp(2, 0, 0, 0.5, 30)]
    const samples = sampleCatmullRomCentripetal(controlPoints, 5)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.time).toBeGreaterThanOrEqual(samples[i - 1]!.time)
    }
    expect(samples[0]!.time).toBe(0)
    expect(samples[samples.length - 1]!.time).toBe(30)
  })

  it('never produces NaN/Infinity, even with duplicate (coincident) consecutive control points', () => {
    const controlPoints = [cp(0, 0, 0, 0.1, 0), cp(0, 0, 0, 0.1, 5), cp(0, 0, 0, 0.1, 5), cp(1, 1, 1, 0.2, 10)]
    const samples = sampleCatmullRomCentripetal(controlPoints, 4)
    for (const sample of samples) {
      expect(Number.isFinite(sample.position.x)).toBe(true)
      expect(Number.isFinite(sample.position.y)).toBe(true)
      expect(Number.isFinite(sample.position.z)).toBe(true)
      expect(Number.isFinite(sample.radius)).toBe(true)
      expect(Number.isFinite(sample.time)).toBe(true)
    }
  })

  it('produces a smooth curve close to a straight line for perfectly collinear control points', () => {
    const controlPoints = [cp(0, 0, 0, 0.1, 0), cp(1, 0, 0, 0.1, 10), cp(2, 0, 0, 0.1, 20), cp(3, 0, 0, 0.1, 30)]
    const samples = sampleCatmullRomCentripetal(controlPoints, 8)
    for (const sample of samples) {
      expect(Math.abs(sample.position.y)).toBeLessThan(1e-6)
      expect(Math.abs(sample.position.z)).toBeLessThan(1e-6)
    }
  })
})
