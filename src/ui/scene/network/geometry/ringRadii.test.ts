import { describe, expect, it } from 'vitest'
import type { GrowthRing } from '../../../../domain/network'
import { dedupeRingRadii } from './ringRadii'

function ring(radius: number): GrowthRing {
  return { id: `ring-${radius}`, kind: 'ring', ringKind: 'release', time: 0, radius, ref: null }
}

describe('dedupeRingRadii', () => {
  it('sorts and merges rings within epsilon of each other', () => {
    const rings = [ring(1), ring(1.01), ring(2), ring(0.5)]
    const result = dedupeRingRadii(rings, 0.05, 10)
    expect(result).toEqual([0.5, 1, 2])
  })

  it('caps at maxCount, keeping the innermost rings', () => {
    const rings = [ring(1), ring(2), ring(3), ring(4)]
    const result = dedupeRingRadii(rings, 0.001, 2)
    expect(result).toEqual([1, 2])
  })

  it('returns an empty array for no rings', () => {
    expect(dedupeRingRadii([], 0.01, 10)).toEqual([])
  })
})
