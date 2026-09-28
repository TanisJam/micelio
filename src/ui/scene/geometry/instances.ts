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

const EULER_ORDER: THREE.EulerOrder = 'XYZ'

/**
 * Position + uniform scale + rotation matrix, for leaves/fruit/flowers/buds
 * scattered clusters. `tiltX`/`tiltZ` (both default 0) add a small
 * off-vertical tilt on top of the Y rotation, so instances of the same
 * shared geometry don't all sit perfectly flat -- gives the canopy volume
 * instead of a "stack of discs" look.
 */
export function scatteredInstanceMatrix(
  position: Vec3,
  yRotation: number,
  scale: number,
  tiltX = 0,
  tiltZ = 0,
): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yRotation, tiltZ, EULER_ORDER))
  const matrix = new THREE.Matrix4()
  matrix.compose(new THREE.Vector3(position.x, position.y, position.z), quaternion, new THREE.Vector3(scale, scale, scale))
  return matrix
}
