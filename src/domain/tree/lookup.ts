import type { LookupableTreeElement, TreeModel } from './types'

/**
 * Finds the model element with the given id, regardless of which array it
 * lives in. Returns `null` for the synthetic `'trunk'` id (the trunk is a
 * single mesh with no per-segment selection, see `TrunkMesh`) or an unknown
 * id. Linear scan -- only called on click/hover-resolve, never per frame.
 */
export function findTreeElement(model: TreeModel, id: string): LookupableTreeElement | null {
  if (id === 'trunk') return null
  for (const limb of model.limbs) if (limb.id === id) return limb
  for (const twig of model.twigs) if (twig.id === id) return twig
  for (const fruit of model.fruits) if (fruit.id === id) return fruit
  for (const leaf of model.leaves) if (leaf.id === id) return leaf
  for (const flower of model.flowers) if (flower.id === id) return flower
  for (const bud of model.buds) if (bud.id === id) return bud
  return null
}
