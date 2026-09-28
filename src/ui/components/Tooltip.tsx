import type { ElementSummary } from '../../domain/elementDetail'
import { formatDate } from '../../domain/format'
import { ui } from '../theme/tokens'

export interface TooltipProps {
  summary: ElementSummary
  /** Viewport coordinates, in CSS pixels. */
  x: number
  y: number
}

const OFFSET = 14

/** Small hover tooltip following the pointer: kind + title + date (P7). */
export function Tooltip({ summary, x, y }: TooltipProps) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: x + OFFSET,
        top: y + OFFSET,
        maxWidth: 260,
        pointerEvents: 'none',
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(2),
        padding: `${ui.space(1)} ${ui.space(2)}`,
        color: ui.text,
        fontFamily: ui.fontBody,
        fontSize: '0.78rem',
        lineHeight: 1.35,
        backdropFilter: 'blur(6px)',
        zIndex: 20,
      }}
    >
      <div style={{ color: ui.accent, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {summary.kindLabel}
      </div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.title}</div>
      {summary.date !== null && <div style={{ color: ui.textMuted }}>{formatDate(summary.date)}</div>}
    </div>
  )
}
