import { useEffect, useState } from 'react'
import { summarizeElementDetail, type ElementDetail } from '../../domain/elementDetail'
import { Tooltip } from './Tooltip'

export interface TooltipLayerProps {
  /** id -> detail view-model, metaphor-agnostic (tree: `resolveElementDetail`, network: `resolveNetworkElementDetail`, both bound to their own model/snapshot by the caller). */
  resolveDetail: (id: string) => ElementDetail | null
  hoveredId: string | null
}

/**
 * Tracks the pointer (only while something is hovered) and renders the hover
 * tooltip near it. Kept as its own component so the pointer-position state
 * doesn't re-render the 3D scene above it on every mouse move.
 */
export function TooltipLayer({ resolveDetail, hoveredId }: TooltipLayerProps) {
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
  const detail = resolveDetail(hoveredId)
  if (!detail) return null
  return <Tooltip summary={summarizeElementDetail(detail)} x={pointer.x} y={pointer.y} />
}
