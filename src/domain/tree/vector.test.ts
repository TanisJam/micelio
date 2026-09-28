import { describe, expect, it } from 'vitest'
import { subVec3, vec3Length } from './vector'

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
