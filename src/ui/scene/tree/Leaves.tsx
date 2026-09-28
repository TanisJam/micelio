import { useMemo } from 'react'
import { limbFullyGrownTime, type TreeModel } from '../../../domain/tree'
import { leafColorForAge } from '../../theme/tokens'
import { leafGeometry } from '../geometry/shapes'
import { ScatterInstances, type ScatterItem } from './ScatterInstances'

export interface LeavesProps {
  model: TreeModel
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}

export function Leaves({ model, getCurrentTime, onHover, onSelect }: LeavesProps) {
  const items = useMemo<ScatterItem[]>(() => {
    // A leaf's commit date is often *before* its PR's merge date (its
    // twig's sprout time), so gate twig-leaves on the later of the two.
    // Overflow leaves (twigId === null) are scattered at a *random*
    // position along their limb -- not tied to any twig's index -- so the
    // only time it's always safe to show one is once the whole limb has
    // finished growing (see `limbFullyGrownTime`). Either way, a leaf must
    // never appear to float in space before the branch carrying it exists.
    const twigTimeById = new Map(model.twigs.map((twig) => [twig.id, twig.time]))
    const limbFullyGrownTimeById = new Map(
      model.limbs.map((limb) => [limb.id, limbFullyGrownTime(limb, model.twigs, model.bounds)]),
    )

    return model.leaves.map((leaf) => {
      const supportTime =
        leaf.twigId !== null
          ? (twigTimeById.get(leaf.twigId) ?? leaf.time)
          : (limbFullyGrownTimeById.get(leaf.limbId) ?? leaf.time)
      return {
        id: leaf.id,
        position: leaf.position,
        rotation: leaf.rotation,
        scale: leaf.scale,
        time: Math.max(leaf.time, supportTime),
        color: leafColorForAge(leaf.age),
      }
    })
  }, [model])

  return (
    <ScatterInstances
      geometry={leafGeometry}
      items={items}
      bounds={model.bounds}
      getCurrentTime={getCurrentTime}
      onHover={onHover}
      onSelect={onSelect}
    />
  )
}
