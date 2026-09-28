import type { TreeModel } from './types'
import type { Vec3 } from './vector'

export interface ModelBounds {
  /** Approximate center of mass of every rendered element. */
  center: Vec3
  /** Distance from `center` that encloses every element, plus a small margin. */
  radius: number
  /** Highest Y coordinate across every element (crown height, buds included). */
  maxHeight: number
}

const MARGIN = 1.15

function collectPoints(model: TreeModel): Vec3[] {
  const points: Vec3[] = [{ x: 0, y: 0, z: 0 }]

  for (const segment of model.trunk.segments) {
    points.push(segment.start, segment.end)
  }
  for (const limb of model.limbs) {
    for (const point of limb.points) points.push(point.position)
  }
  for (const twig of model.twigs) {
    for (const point of twig.points) points.push(point.position)
  }
  for (const fruit of model.fruits) points.push(fruit.position)
  for (const leaf of model.leaves) points.push(leaf.position)
  for (const flower of model.flowers) points.push(flower.position)
  for (const bud of model.buds) points.push(bud.position)

  return points
}

/**
 * Computes a bounding sphere (plus crown height) around every element in a
 * `TreeModel`, so the camera can auto-frame the whole tree regardless of its
 * shape. Pure, deterministic -- no three.js.
 */
export function computeModelBounds(model: TreeModel): ModelBounds {
  const points = collectPoints(model)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
    if (point.z < minZ) minZ = point.z
    if (point.z > maxZ) maxZ = point.z
  }

  const center: Vec3 = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  }

  let maxDistanceSq = 0
  for (const point of points) {
    const dx = point.x - center.x
    const dy = point.y - center.y
    const dz = point.z - center.z
    const distanceSq = dx * dx + dy * dy + dz * dz
    if (distanceSq > maxDistanceSq) maxDistanceSq = distanceSq
  }

  const radius = Math.max(Math.sqrt(maxDistanceSq) * MARGIN, 0.5)

  return { center, radius, maxHeight: maxY }
}
