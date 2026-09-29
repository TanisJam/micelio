import { findNetworkElement } from './lookup'
import type { NetworkModel } from './types'
import type { Vec3 } from '../shared/vector'

/**
 * Resolves the 3D point the camera should fly to when `id` is selected
 * (mirrors `../tree/focus`). A hypha focuses the midpoint of its polyline,
 * not just its base, so the camera settles on the loop/branch itself.
 */
export function getNetworkElementFocusPosition(model: NetworkModel, id: string): Vec3 | null {
  if (id === 'spore') return model.spore.position

  const element = findNetworkElement(model, id)
  if (!element) return null

  switch (element.kind) {
    case 'main':
    case 'merged':
    case 'closed':
    case 'open':
    case 'liveBranch':
      return element.points.length > 0 ? element.points[Math.floor(element.points.length / 2)]!.position : null
    case 'node':
    case 'tip':
    case 'mushroom':
      return element.position
    default:
      return null
  }
}
