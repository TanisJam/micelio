import { useMemo } from 'react'
import type { TreeModel } from '../../../domain/tree'
import { palette } from '../../theme/tokens'
import { fruitGeometry } from '../geometry/shapes'
import { ScatterInstances, type ScatterItem } from './ScatterInstances'

export interface FruitsProps {
  model: TreeModel
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

export function Fruits({ model, getCurrentTime, onHover, onSelect, hoveredId, selectedId }: FruitsProps) {
  const items = useMemo<ScatterItem[]>(
    () =>
      model.fruits.map((fruit) => ({
        id: fruit.id,
        position: fruit.position,
        rotation: 0,
        scale: fruit.scale,
        time: fruit.time,
        color: palette.fruit,
      })),
    [model],
  )

  return (
    <ScatterInstances
      geometry={fruitGeometry}
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
