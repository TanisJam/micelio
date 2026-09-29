import * as THREE from 'three'
import type { Vec3 } from '../../../../domain/shared'
import type { PickTarget } from '../picking/pickingGrid'

/**
 * Generic per-instance transform builder for small point-like `InstancedMesh`
 * elements that share one uniform scale/color per mesh (fusion knots, growing
 * tips) -- simpler than `mushroomInstances.ts` (no per-instance rotation/
 * color variance needed for these).
 */

export interface PointInstanceSource {
  id: string
  time: number
  position: Vec3
}

export interface PointInstancesResult {
  matrices: THREE.Matrix4[]
  birthTimes: number[]
  pickTargets: PickTarget[]
}

export function buildPointInstances(sources: PointInstanceSource[], scale: number): PointInstancesResult {
  const matrices: THREE.Matrix4[] = []
  const birthTimes: number[] = []
  const pickTargets: PickTarget[] = []

  for (const source of sources) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(source.position.x, source.position.y, source.position.z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale),
    )
    matrices.push(matrix)
    birthTimes.push(source.time)
    pickTargets.push({ id: source.id, x1: source.position.x, z1: source.position.z, x2: source.position.x, z2: source.position.z })
  }

  return { matrices, birthTimes, pickTargets }
}
