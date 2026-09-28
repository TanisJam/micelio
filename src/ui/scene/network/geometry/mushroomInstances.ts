import * as THREE from 'three'
import type { Mushroom } from '../../../../domain/network'
import { createPrng, randRange } from '../../../../domain/tree'
import type { PickTarget } from '../picking/pickingGrid'

/**
 * Per-instance transforms for the shared mushroom geometry
 * (`mushroomGeometry.ts`), one `InstancedMesh` for every release (P12: a
 * single draw call). Clustered releases already fan out along the disc in
 * the domain model (`mushrooms.ts`'s deterministic scatter, M2d round 6) --
 * this only adds a small seeded per-mushroom rotation/height variance so a
 * cluster doesn't look like identical stamped copies (a cosmetic render-time
 * touch, not a data claim).
 */

const BASE_SCALE = 0.16
const HEIGHT_JITTER = 0.05
const MIN_HEIGHT_MULTIPLIER = 0.9

export interface MushroomInstancesResult {
  matrices: THREE.Matrix4[]
  birthTimes: number[]
  pickTargets: PickTarget[]
}

export function buildMushroomInstances(mushrooms: Mushroom[]): MushroomInstancesResult {
  const matrices: THREE.Matrix4[] = []
  const birthTimes: number[] = []
  const pickTargets: PickTarget[] = []

  for (const mushroom of mushrooms) {
    const prng = createPrng(mushroom.id)
    const rotationY = randRange(prng, 0, Math.PI * 2)
    const heightMultiplier = MIN_HEIGHT_MULTIPLIER + randRange(prng, 0, HEIGHT_JITTER)
    const scale = BASE_SCALE * Math.max(0.6, mushroom.scale)

    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0))
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(mushroom.position.x, mushroom.position.y, mushroom.position.z),
      quaternion,
      new THREE.Vector3(scale, scale * heightMultiplier, scale),
    )
    matrices.push(matrix)
    birthTimes.push(mushroom.time)
    pickTargets.push({ id: mushroom.id, x1: mushroom.position.x, z1: mushroom.position.z, x2: mushroom.position.x, z2: mushroom.position.z })
  }

  return { matrices, birthTimes, pickTargets }
}
