import type { LookupableNetworkElement, NetworkModel } from './types'

/**
 * Finds the network model element with the given id, regardless of which
 * array it lives in. Returns `null` for the synthetic `'spore'` id (look it
 * up via `model.spore` directly) or an unknown id. Linear scan -- only
 * called on click/hover-resolve, never per frame (mirrors `../tree/lookup`).
 */
export function findNetworkElement(model: NetworkModel, id: string): LookupableNetworkElement | null {
  if (id === 'spore') return null
  for (const hypha of model.hyphae) if (hypha.id === id) return hypha
  for (const node of model.nodes) if (node.id === id) return node
  for (const tip of model.tips) if (tip.id === id) return tip
  for (const mushroom of model.mushrooms) if (mushroom.id === id) return mushroom
  return null
}
