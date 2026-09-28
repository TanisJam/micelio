import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { alignedInstanceMatrix, scatteredInstanceMatrix } from './instances'

describe('alignedInstanceMatrix', () => {
  it('places the instance at the given position', () => {
    const matrix = alignedInstanceMatrix({ x: 1, y: 2, z: 3 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 })
    const position = new THREE.Vector3()
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3())
    expect(position.x).toBeCloseTo(1)
    expect(position.y).toBeCloseTo(2)
    expect(position.z).toBeCloseTo(3)
  })

  it('rotates local +Y to align with the given direction', () => {
    const matrix = alignedInstanceMatrix({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })
    const quaternion = new THREE.Quaternion()
    matrix.decompose(new THREE.Vector3(), quaternion, new THREE.Vector3())
    const rotatedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
    expect(rotatedUp.x).toBeCloseTo(1, 4)
    expect(rotatedUp.y).toBeCloseTo(0, 4)
    expect(rotatedUp.z).toBeCloseTo(0, 4)
  })

  it('falls back to world up for a zero-length direction, without NaN', () => {
    const matrix = alignedInstanceMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })
    const elements = matrix.elements
    for (const value of elements) expect(Number.isFinite(value)).toBe(true)
  })

  it('applies non-uniform scale', () => {
    const matrix = alignedInstanceMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 2, y: 3, z: 4 })
    const scale = new THREE.Vector3()
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)
    expect(scale.x).toBeCloseTo(2)
    expect(scale.y).toBeCloseTo(3)
    expect(scale.z).toBeCloseTo(4)
  })
})

describe('scatteredInstanceMatrix', () => {
  it('applies uniform scale and position', () => {
    const matrix = scatteredInstanceMatrix({ x: 1, y: 2, z: 3 }, 0, 0.5)
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    matrix.decompose(position, new THREE.Quaternion(), scale)
    expect(position.x).toBeCloseTo(1)
    expect(scale.x).toBeCloseTo(0.5)
    expect(scale.y).toBeCloseTo(0.5)
    expect(scale.z).toBeCloseTo(0.5)
  })
})
