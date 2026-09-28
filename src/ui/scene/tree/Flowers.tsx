import { useMemo } from 'react'
import type { TreeModel } from '../../../domain/tree'
import { palette } from '../../theme/tokens'
import { flowerGeometry } from '../geometry/shapes'
import { ScatterInstances, type ScatterItem } from './ScatterInstances'

export interface FlowersProps {
  model: TreeModel
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

export function Flowers({ model, getCurrentTime, onHover, onSelect, hoveredId, selectedId }: FlowersProps) {
  const items = useMemo<ScatterItem[]>(
    () =>
      model.flowers.map((flower) => ({
        id: flower.id,
        position: flower.position,
        rotation: 0,
        scale: flower.scale,
        time: flower.time,
        color: palette.blossom,
      })),
    [model],
  )

  return (
    <ScatterInstances
      geometry={flowerGeometry}
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
