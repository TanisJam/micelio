import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildPointInstances, type PointInstanceSource } from './pointInstances'

describe('buildPointInstances', () => {
  it('produces one matrix/birthTime/pickTarget per source, positioned correctly', () => {
    const sources: PointInstanceSource[] = [
      { id: 'fusion-a', time: 10, position: { x: 1, y: 0, z: 2 } },
      { id: 'fusion-b', time: 20, position: { x: -1, y: 0.1, z: 0 } },
    ]
    const result = buildPointInstances(sources, 0.05)
    expect(result.matrices).toHaveLength(2)
    expect(result.birthTimes).toEqual([10, 20])
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    result.matrices[0]!.decompose(position, quaternion, scale)
    expect(position.x).toBeCloseTo(1)
    expect(position.z).toBeCloseTo(2)
  })

  it('never produces NaN/non-finite matrix elements', () => {
    const result = buildPointInstances([{ id: 'a', time: 0, position: { x: 0, y: 0, z: 0 } }], 0)
    for (const value of result.matrices[0]!.toArray()) expect(Number.isFinite(value)).toBe(true)
  })

  it('returns empty arrays for an empty source list', () => {
    const result = buildPointInstances([], 1)
    expect(result.matrices).toEqual([])
    expect(result.pickTargets).toEqual([])
  })
})
