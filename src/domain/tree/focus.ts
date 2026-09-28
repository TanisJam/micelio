import { findTreeElement } from './lookup'
import type { TreeModel } from './types'
import type { Vec3 } from './vector'

/**
 * Resolves the 3D point the camera should fly to when `id` is selected. The
 * trunk has no per-segment selection (see `findTreeElement`), so it focuses
 * the trunk's midpoint; a limb focuses the midpoint of its polyline (not
 * just its base) so the camera settles on the branch, not the trunk joint.
 */
export function getElementFocusPosition(model: TreeModel, id: string): Vec3 | null {
  if (id === 'trunk') return { x: 0, y: model.trunk.height * 0.5, z: 0 }

  const element = findTreeElement(model, id)
  if (!element) return null

  switch (element.kind) {
    case 'limb':
      return element.points[Math.floor(element.points.length / 2)]!.position
    case 'twig':
      return element.points[element.points.length - 1]!.position
    case 'fruit':
    case 'leaf':
    case 'flower':
    case 'bud':
      return element.position
    default:
      return null
  }
}
