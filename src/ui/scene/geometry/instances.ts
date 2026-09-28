import * as THREE from 'three'
import type { Vec3 } from '../../../domain/tree'

const DEFAULT_UP = new THREE.Vector3(0, 1, 0)

/**
 * Composes an instance matrix that places a unit object at `position`,
 * rotated so its local +Y axis points along `direction` (falls back to
 * world up when `direction` is degenerate), and non-uniformly scaled by
 * `scale`. Used for twigs (aligned to their base->tip direction, scaled
 * along Y for growth) and for simple billboards/clusters (uniform scale,
 * default direction).
 */
export function alignedInstanceMatrix(position: Vec3, direction: Vec3 | null, scale: Vec3): THREE.Matrix4 {
  const dir = direction ? new THREE.Vector3(direction.x, direction.y, direction.z) : DEFAULT_UP.clone()
  if (dir.lengthSq() < 1e-8) dir.copy(DEFAULT_UP)
  dir.normalize()

  const quaternion = new THREE.Quaternion().setFromUnitVectors(DEFAULT_UP, dir)
  const matrix = new THREE.Matrix4()
  matrix.compose(
    new THREE.Vector3(position.x, position.y, position.z),
    quaternion,
    new THREE.Vector3(scale.x, scale.y, scale.z),
  )
  return matrix
}

/** Simple position + uniform scale + Y rotation matrix, for leaves/fruit/flowers/buds scattered clusters. */
export function scatteredInstanceMatrix(position: Vec3, yRotation: number, scale: number): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(DEFAULT_UP, yRotation)
  const matrix = new THREE.Matrix4()
  matrix.compose(new THREE.Vector3(position.x, position.y, position.z), quaternion, new THREE.Vector3(scale, scale, scale))
  return matrix
}
