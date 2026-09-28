import { useMemo } from 'react'
import type { TreeModel } from '../../../domain/tree'
import { palette } from '../../theme/tokens'
import { budGeometry } from '../geometry/shapes'
import { ScatterInstances, type ScatterItem } from './ScatterInstances'

export interface BudsProps {
  model: TreeModel
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}

export function Buds({ model, getCurrentTime, onHover, onSelect }: BudsProps) {
  // Buds sit at the crown, i.e. the trunk's *final* height -- so during the
  // growth replay they must never pop in before the trunk has visually grown
  // that tall, or they'd appear to float above an unfinished trunk tip.
  const trunkFullyGrownTime = model.trunk.segments[model.trunk.segments.length - 1]?.time ?? model.bounds.lastEventTime

  const items = useMemo<ScatterItem[]>(
    () =>
      model.buds.map((bud) => ({
        id: bud.id,
        position: bud.position,
        rotation: 0,
        scale: bud.scale,
        time: Math.max(bud.time, trunkFullyGrownTime),
        color: palette.bud,
      })),
    [model, trunkFullyGrownTime],
  )

  return (
    <ScatterInstances
      geometry={budGeometry}
      items={items}
      bounds={model.bounds}
      getCurrentTime={getCurrentTime}
      onHover={onHover}
      onSelect={onSelect}
    />
  )
}
