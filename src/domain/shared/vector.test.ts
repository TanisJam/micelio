import { describe, expect, it } from 'vitest'
import { normalizeVec3, subVec3, vec3Length } from './vector'

describe('subVec3', () => {
  it('subtracts component-wise', () => {
    expect(subVec3({ x: 5, y: 3, z: 1 }, { x: 2, y: 1, z: 1 })).toEqual({ x: 3, y: 2, z: 0 })
  })
})

describe('vec3Length', () => {
  it('returns 0 for the zero vector', () => {
    expect(vec3Length({ x: 0, y: 0, z: 0 })).toBe(0)
  })

  it('computes the Euclidean length', () => {
    expect(vec3Length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5)
  })
})

describe('normalizeVec3', () => {
  it('returns a unit-length vector in the same direction', () => {
    const result = normalizeVec3({ x: 3, y: 4, z: 0 })
    expect(vec3Length(result)).toBeCloseTo(1)
    expect(result.x).toBeCloseTo(0.6)
    expect(result.y).toBeCloseTo(0.8)
    expect(result.z).toBeCloseTo(0)
  })

  it('falls back to +Z (never NaN) for a near-zero vector', () => {
    expect(normalizeVec3({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('uses a custom fallback when given one', () => {
    expect(normalizeVec3({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 })
  })
})
