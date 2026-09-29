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

// M3c item 1: mushrooms were reading as huge cream cotton-ball blobs at
// full-disc zoom -- scaled down ~3.5x from the M3b value (0.42) so they read
// as tiny glowing fungi dotted across the galaxy, never bigger than a few px
// of cap. The old `Math.max(0.75, mushroom.scale)` floor is also gone (see
// below): it clamped `MUSHROOM_SCALE_PATCH`/`MINOR` (0.55/0.75) up to the
// same 0.75, so patch releases never actually rendered smaller than minor
// ones -- the floor made the domain's own major/minor/patch scale mostly
// moot except for majors.
const BASE_SCALE = 0.12
const HEIGHT_JITTER = 0.05
const MIN_HEIGHT_MULTIPLIER = 0.9
/** Small seeded per-mushroom vertical offset (P1's mushroom brief: "a subtle vertical stagger") -- purely a render-time read cue so a cluster of same-height caps doesn't read as one flat row/line of dots; never a data claim (the underlying `Mushroom.position.y` -- the real release-anchored lift -- is untouched). */
const VERTICAL_STAGGER = 0.045

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
    const scale = BASE_SCALE * mushroom.scale
    const verticalStagger = randRange(prng, 0, VERTICAL_STAGGER)

    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0))
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(mushroom.position.x, mushroom.position.y + verticalStagger, mushroom.position.z),
      quaternion,
      new THREE.Vector3(scale, scale * heightMultiplier, scale),
    )
    matrices.push(matrix)
    birthTimes.push(mushroom.time)
    pickTargets.push({ id: mushroom.id, x1: mushroom.position.x, z1: mushroom.position.z, x2: mushroom.position.x, z2: mushroom.position.z })
  }

  return { matrices, birthTimes, pickTargets }
}
