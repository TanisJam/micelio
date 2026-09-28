import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../../../domain/tree'
import { buildTubeGeometry, drawRangeForProgress, type TubeGeometryPoint } from './tubeGeometry'

function taperedPoints(count: number): TubeGeometryPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    position: { x: 0, y: i, z: 0 } satisfies Vec3,
    radius: 1 - i / (count - 1),
  }))
}

describe('buildTubeGeometry', () => {
  it('produces a geometry with the expected vertex and index counts', () => {
    const points = taperedPoints(5)
    const radialSegments = 6
    const { geometry, ringCount, indicesPerRingStep } = buildTubeGeometry(points, radialSegments)

    const verticesPerRing = radialSegments + 1
    expect(geometry.getAttribute('position').count).toBe(verticesPerRing * points.length)
    expect(ringCount).toBe(points.length)
    expect(indicesPerRingStep).toBe(radialSegments * 6)
    expect(geometry.getIndex()!.count).toBe((points.length - 1) * indicesPerRingStep)
  })

  it('never produces NaN or infinite vertex positions', () => {
    const { geometry } = buildTubeGeometry(taperedPoints(6), 5)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true)
      expect(Number.isFinite(position.getY(i))).toBe(true)
      expect(Number.isFinite(position.getZ(i))).toBe(true)
    }
  })

  it('rings shrink toward the tip as radius tapers to 0', () => {
    const { geometry } = buildTubeGeometry(taperedPoints(4), 8)
    const position = geometry.getAttribute('position')
    const verticesPerRing = 9

    const ringRadius = (ring: number) => {
      let maxDist = 0
      for (let seg = 0; seg < verticesPerRing; seg++) {
        const i = ring * verticesPerRing + seg
        const dist = Math.hypot(position.getX(i), position.getZ(i))
        maxDist = Math.max(maxDist, dist)
      }
      return maxDist
    }

    expect(ringRadius(0)).toBeGreaterThan(ringRadius(3))
  })

  it('throws for fewer than 2 points or fewer than 3 radial segments', () => {
    expect(() => buildTubeGeometry([{ position: { x: 0, y: 0, z: 0 }, radius: 1 }], 6)).toThrow(RangeError)
    expect(() => buildTubeGeometry(taperedPoints(3), 2)).toThrow(RangeError)
  })
})

describe('drawRangeForProgress', () => {
  it('is 0 at progress 0 and the full index count at progress 1', () => {
    const result = buildTubeGeometry(taperedPoints(5), 6)
    expect(drawRangeForProgress(result, 0)).toBe(0)
    expect(drawRangeForProgress(result, 1)).toBe(result.geometry.getIndex()!.count)
  })

  it('is monotonic non-decreasing and clamped outside [0, 1]', () => {
    const result = buildTubeGeometry(taperedPoints(6), 6)
    let previous = -1
    for (let p = -0.5; p <= 1.5; p += 0.1) {
      const value = drawRangeForProgress(result, p)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
    expect(drawRangeForProgress(result, -1)).toBe(0)
    expect(drawRangeForProgress(result, 2)).toBe(result.geometry.getIndex()!.count)
  })
})
