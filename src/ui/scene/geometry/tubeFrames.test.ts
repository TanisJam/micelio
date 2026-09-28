import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../../../domain/tree'
import { computeTubeFrames } from './tubeFrames'

function straightUp(count: number): Vec3[] {
  return Array.from({ length: count }, (_, i) => ({ x: 0, y: i, z: 0 }))
}

function curvedPath(count: number): Vec3[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.sin(i * 0.3) * 0.5,
    y: i,
    z: Math.cos(i * 0.3) * 0.5,
  }))
}

describe('computeTubeFrames', () => {
  it('returns one frame per point', () => {
    const frames = computeTubeFrames(straightUp(5))
    expect(frames).toHaveLength(5)
  })

  it('throws for fewer than two points', () => {
    expect(() => computeTubeFrames([{ x: 0, y: 0, z: 0 }])).toThrow(RangeError)
  })

  it('every frame is orthonormal and finite, even for a perfectly vertical path', () => {
    const frames = computeTubeFrames(straightUp(6))
    for (const { tangent, normal, binormal } of frames) {
      for (const v of [tangent, normal, binormal]) {
        expect(Number.isFinite(v.x)).toBe(true)
        expect(Number.isFinite(v.y)).toBe(true)
        expect(Number.isFinite(v.z)).toBe(true)
        expect(v.length()).toBeCloseTo(1, 5)
      }
      expect(tangent.dot(normal)).toBeCloseTo(0, 5)
      expect(tangent.dot(binormal)).toBeCloseTo(0, 5)
      expect(normal.dot(binormal)).toBeCloseTo(0, 5)
    }
  })

  it('handles a curved polyline without NaNs, still orthonormal', () => {
    const frames = computeTubeFrames(curvedPath(8))
    for (const { tangent, normal, binormal } of frames) {
      expect(tangent.length()).toBeCloseTo(1, 5)
      expect(normal.length()).toBeCloseTo(1, 5)
      expect(binormal.length()).toBeCloseTo(1, 5)
      expect(tangent.dot(normal)).toBeCloseTo(0, 5)
    }
  })

  it('falls back to a default tangent when neighbors coincide (zero-length segment)', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]
    const frames = computeTubeFrames(points)
    for (const { tangent, normal, binormal } of frames) {
      expect(Number.isFinite(tangent.x)).toBe(true)
      expect(tangent.length()).toBeCloseTo(1, 5)
      expect(normal.length()).toBeCloseTo(1, 5)
      expect(binormal.length()).toBeCloseTo(1, 5)
    }
  })
})
