import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyGrowthToInstances, HIGHLIGHT_SCALE } from './applyGrowth'

function makeMesh(count: number): THREE.InstancedMesh {
  return new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), count)
}

/**
 * Reads back the RAW length of the matrix's X basis column (elements
 * 0..2), never via `Matrix4.decompose()` -- decompose specifically guards
 * against a fully degenerate (all-zero) linear part by falling back to
 * scale `1` to avoid propagating `NaN` into the recovered quaternion, which
 * would make a genuinely zeroed-out (hidden) instance's raw GPU matrix
 * misreport as "scale 1" here. The renderer only ever sees the raw
 * elements, so that's what a real "is this hidden" test must inspect too.
 */
function readXAxisLength(mesh: THREE.InstancedMesh, index: number): number {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  const e = matrix.elements
  return Math.hypot(e[0]!, e[1]!, e[2]!)
}

function readScale(mesh: THREE.InstancedMesh, index: number): THREE.Vector3 {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  matrix.decompose(position, quaternion, scale)
  return scale
}

function readPosition(mesh: THREE.InstancedMesh, index: number): THREE.Vector3 {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  return new THREE.Vector3().setFromMatrixPosition(matrix)
}

describe('applyGrowthToInstances', () => {
  it('places a grown instance at its real matrix', () => {
    const mesh = makeMesh(1)
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
    applyGrowthToInstances(mesh, [matrix], [0], 100)
    expect(readPosition(mesh, 0).toArray()).toEqual([1, 2, 3])
  })

  it('hides a not-yet-grown instance (moved away and scaled to zero)', () => {
    const mesh = makeMesh(1)
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
    applyGrowthToInstances(mesh, [matrix], [1000], 500)
    expect(readXAxisLength(mesh, 0)).toBe(0)
    expect(readPosition(mesh, 0).y).toBe(-1000)
  })

  it('scales up the highlighted grown instance by HIGHLIGHT_SCALE (A3/T8)', () => {
    const mesh = makeMesh(2)
    const matrices = [
      new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)),
      new THREE.Matrix4().compose(new THREE.Vector3(5, 0, 0), new THREE.Quaternion(), new THREE.Vector3(2, 2, 2)),
    ]
    applyGrowthToInstances(mesh, matrices, [0, 0], 100, 1)
    expect(readScale(mesh, 0).toArray()).toEqual([1, 1, 1]) // not highlighted, unchanged
    const highlighted = readScale(mesh, 1)
    expect(highlighted.x).toBeCloseTo(2 * HIGHLIGHT_SCALE, 5)
    // Highlighting scales around the instance's own center, never its world position.
    expect(readPosition(mesh, 1).toArray()).toEqual([5, 0, 0])
  })

  it('never highlights a not-yet-grown instance even if its index matches', () => {
    const mesh = makeMesh(1)
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
    applyGrowthToInstances(mesh, [matrix], [1000], 500, 0)
    expect(readXAxisLength(mesh, 0)).toBe(0) // still hidden, not blown up to HIGHLIGHT_SCALE
  })

  it('defaults to no highlight (-1) when the parameter is omitted', () => {
    const mesh = makeMesh(1)
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(3, 3, 3))
    applyGrowthToInstances(mesh, [matrix], [0], 100)
    expect(readScale(mesh, 0).toArray()).toEqual([3, 3, 3])
  })
})
