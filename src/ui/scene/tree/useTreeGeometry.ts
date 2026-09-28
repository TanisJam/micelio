import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  computeModelBounds,
  subVec3,
  vec3Length,
  type Bud,
  type Flower,
  type Fruit,
  type Leaf,
  type ModelBounds,
  type TreeModel,
  type Twig,
} from '../../../domain/tree'
import { barkColorAt } from '../../theme/tokens'
import { buildIslandGeometry } from '../geometry/island'
import { buildTubeGeometry, type TubeGeometryResult } from '../geometry/tubeGeometry'

const TRUNK_RADIAL_SEGMENTS = 7
const LIMB_RADIAL_SEGMENTS = 6
const TWIG_RADIAL_SEGMENTS = 5
const TWIG_TIP_TAPER = 0.32

export interface LimbGeometryEntry {
  id: string
  eraIndex: number
  geometry: THREE.BufferGeometry
  tube: TubeGeometryResult
  color: string
}

export interface TwigInstanceData {
  ids: string[]
  data: Twig[]
  /** Base position and unit direction per twig, for aligning the instanced mesh. */
  base: THREE.Vector3[]
  direction: THREE.Vector3[]
  length: number[]
  radius: number
}

export interface ScatterInstanceData<T> {
  ids: string[]
  data: T[]
}

export interface TreeGeometry {
  trunk: { geometry: THREE.BufferGeometry; tube: TubeGeometryResult; color: string }
  limbs: LimbGeometryEntry[]
  twigGeometry: THREE.BufferGeometry
  twigs: TwigInstanceData
  leaves: ScatterInstanceData<Leaf>
  fruits: ScatterInstanceData<Fruit>
  flowers: ScatterInstanceData<Flower>
  buds: ScatterInstanceData<Bud>
  island: THREE.BufferGeometry
  bounds: ModelBounds
}

/**
 * Builds every static geometry and per-instance dataset from a `TreeModel`.
 * Memoized on the model (and its seed) so switching repos rebuilds once, and
 * every three.js geometry is disposed when superseded or unmounted (P12).
 */
export function useTreeGeometry(model: TreeModel): TreeGeometry {
  const geometry = useMemo(() => buildTreeGeometry(model), [model])

  useEffect(() => {
    return () => {
      geometry.trunk.geometry.dispose()
      for (const limb of geometry.limbs) limb.geometry.dispose()
      geometry.twigGeometry.dispose()
      geometry.island.dispose()
    }
  }, [geometry])

  return geometry
}

function buildTreeGeometry(model: TreeModel): TreeGeometry {
  const trunkSegments = model.trunk.segments
  const trunkPoints = [
    { position: trunkSegments[0]!.start, radius: trunkSegments[0]!.radiusStart },
    ...trunkSegments.map((segment) => ({ position: segment.end, radius: segment.radiusEnd })),
  ]
  const trunkTube = buildTubeGeometry(dedupeConsecutive(trunkPoints), TRUNK_RADIAL_SEGMENTS)

  const limbs: LimbGeometryEntry[] = model.limbs.map((limb) => {
    const tube = buildTubeGeometry(
      limb.points.map((p) => ({ position: p.position, radius: p.radius })),
      LIMB_RADIAL_SEGMENTS,
    )
    return {
      id: limb.id,
      eraIndex: limb.eraIndex,
      geometry: tube.geometry,
      tube,
      color: barkColorAt(limb.eraIndex / Math.max(1, model.limbs.length - 1)),
    }
  })

  const canonicalTwig = buildTubeGeometry(
    [
      { position: { x: 0, y: 0, z: 0 }, radius: 1 },
      { position: { x: 0, y: 1, z: 0 }, radius: TWIG_TIP_TAPER },
    ],
    TWIG_RADIAL_SEGMENTS,
  )

  const twigBase: THREE.Vector3[] = []
  const twigDirection: THREE.Vector3[] = []
  const twigLength: number[] = []
  for (const twig of model.twigs) {
    const base = twig.points[0]!.position
    const tip = twig.points[twig.points.length - 1]!.position
    const delta = subVec3(tip, base)
    const length = Math.max(vec3Length(delta), 0.001)
    twigBase.push(new THREE.Vector3(base.x, base.y, base.z))
    twigDirection.push(new THREE.Vector3(delta.x / length, delta.y / length, delta.z / length))
    twigLength.push(length)
  }

  const bounds = computeModelBounds(model)

  return {
    trunk: { geometry: trunkTube.geometry, tube: trunkTube, color: barkColorAt(0) },
    limbs,
    twigGeometry: canonicalTwig.geometry,
    twigs: {
      ids: model.twigs.map((t) => t.id),
      data: model.twigs,
      base: twigBase,
      direction: twigDirection,
      length: twigLength,
      radius: model.twigs[0]?.points[0]?.radius ?? 0.018,
    },
    leaves: { ids: model.leaves.map((l) => l.id), data: model.leaves },
    fruits: { ids: model.fruits.map((f) => f.id), data: model.fruits },
    flowers: { ids: model.flowers.map((f) => f.id), data: model.flowers },
    buds: { ids: model.buds.map((b) => b.id), data: model.buds },
    island: buildIslandGeometry(model.soil, model.seed),
    bounds,
  }
}

/** Drops consecutive duplicate points (zero-length segments confuse tube framing). */
function dedupeConsecutive<T extends { position: { x: number; y: number; z: number } }>(points: T[]): T[] {
  const result: T[] = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (
      last &&
      last.position.x === point.position.x &&
      last.position.y === point.position.y &&
      last.position.z === point.position.z
    ) {
      continue
    }
    result.push(point)
  }
  return result
}
