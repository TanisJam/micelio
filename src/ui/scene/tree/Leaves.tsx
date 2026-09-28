import { useMemo } from 'react'
import { createPrng, limbFullyGrownTime, type TreeModel } from '../../../domain/tree'
import { leafColorForAge } from '../../theme/tokens'
import { leafGeometry } from '../geometry/shapes'
import { ScatterInstances, type ScatterItem } from './ScatterInstances'

const LEAF_TILT_RANGE = 0.55 // radians

export interface LeavesProps {
  model: TreeModel
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

export function Leaves({ model, getCurrentTime, onHover, onSelect, hoveredId, selectedId }: LeavesProps) {
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
      // Deterministic per-leaf tilt (rendering flourish only, not part of
      // the domain model): a stable hash of the leaf's own id, so the same
      // repo always renders identically.
      const tiltPrng = createPrng(leaf.id)
      return {
        id: leaf.id,
        position: leaf.position,
        rotation: leaf.rotation,
        scale: leaf.scale,
        time: Math.max(leaf.time, supportTime),
        color: leafColorForAge(leaf.age),
        tiltX: (tiltPrng() - 0.5) * LEAF_TILT_RANGE,
        tiltZ: (tiltPrng() - 0.5) * LEAF_TILT_RANGE,
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
      hoveredId={hoveredId}
      selectedId={selectedId}
    />
  )
}
