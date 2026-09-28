import { describe, expect, it } from 'vitest'
import type { Mushroom } from '../../../../domain/network'
import { buildMushroomInstances } from './mushroomInstances'

function makeMushroom(overrides: Partial<Mushroom>): Mushroom {
  return {
    id: 'mushroom-v1.0.0',
    kind: 'mushroom',
    time: 1000,
    ref: { type: 'release', id: 'v1.0.0' },
    position: { x: 1, y: 0, z: 2 },
    scale: 1,
    clusterId: null,
    nearPr: null,
    ...overrides,
  }
}

describe('buildMushroomInstances', () => {
  it('produces one matrix/birthTime/pickTarget per mushroom', () => {
    const mushrooms = [makeMushroom({}), makeMushroom({ id: 'mushroom-v1.1.0', ref: { type: 'release', id: 'v1.1.0' } })]
    const result = buildMushroomInstances(mushrooms)
    expect(result.matrices).toHaveLength(2)
    expect(result.birthTimes).toEqual([1000, 1000])
    expect(result.pickTargets.map((t) => t.id)).toEqual(['mushroom-v1.0.0', 'mushroom-v1.1.0'])
  })

  it('is deterministic for the same mushroom id', () => {
    const a = buildMushroomInstances([makeMushroom({})])
    const b = buildMushroomInstances([makeMushroom({})])
    expect(a.matrices[0]!.toArray()).toEqual(b.matrices[0]!.toArray())
  })

  it('never produces NaN/non-finite matrix elements', () => {
    const result = buildMushroomInstances([makeMushroom({}), makeMushroom({ id: 'mushroom-x', scale: 0 })])
    for (const matrix of result.matrices) {
      for (const value of matrix.toArray()) expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('a point pick target has equal start/end coordinates', () => {
    const result = buildMushroomInstances([makeMushroom({})])
    const target = result.pickTargets[0]!
    expect(target.x1).toBe(target.x2)
    expect(target.z1).toBe(target.z2)
  })
})
