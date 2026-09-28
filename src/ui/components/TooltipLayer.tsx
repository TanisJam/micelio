import { useEffect, useState } from 'react'
import { resolveElementDetail, summarizeElementDetail } from '../../domain/elementDetail'
import type { RepoSnapshot } from '../../domain/repo'
import type { TreeModel } from '../../domain/tree'
import { Tooltip } from './Tooltip'

export interface TooltipLayerProps {
  model: TreeModel
  snapshot: RepoSnapshot
  hoveredId: string | null
}

/**
 * Tracks the pointer (only while something is hovered) and renders the hover
 * tooltip near it. Kept as its own component so the pointer-position state
 * doesn't re-render the 3D scene above it in the tree on every mouse move.
 */
export function TooltipLayer({ model, snapshot, hoveredId }: TooltipLayerProps) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!hoveredId) return
    function onMove(event: PointerEvent) {
      setPointer({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [hoveredId])

  if (!hoveredId || !pointer) return null
  const detail = resolveElementDetail(model, snapshot, hoveredId)
  if (!detail) return null
  return <Tooltip summary={summarizeElementDetail(detail)} x={pointer.x} y={pointer.y} />
}
