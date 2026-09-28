import type { ReactNode } from 'react'
import { formatDate } from '../../domain/format'
import { ui } from '../theme/tokens'

export interface StateScreenAction {
  label: string
  onClick: () => void
}

export interface StateScreenProps {
  /** A short badge above the title, e.g. "404". Optional. */
  eyebrow?: string
  title: string
  children?: ReactNode
  action?: StateScreenAction
  /** A second, secondary action (e.g. "Try the sample repo" next to "Retry"). */
  secondaryAction?: StateScreenAction
  /** When known, the rate limit's reset time (epoch ms) -- rendered as a formatted date/time. */
  retryAt?: number
}

/**
 * A small pulsing mark used for every product state (loading and error
 * alike) -- deliberately abstract rather than tied to any one visual
 * metaphor, since the 3D scene it stands in for is being redesigned.
 */
function PulseMark({ tone = ui.accent }: { tone?: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="32" cy="32" r="10" fill={tone}>
        <animate attributeName="r" values="10;16;10" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="32" cy="32" r="22" fill="none" stroke={tone} strokeOpacity="0.35" strokeWidth="2">
        <animate attributeName="r" values="22;28;22" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function ActionButton({ action, primary }: { action: StateScreenAction; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      style={{
        fontFamily: ui.fontBody,
        fontSize: '0.9rem',
        padding: `${ui.space(2)} ${ui.space(4)}`,
        borderRadius: ui.space(2),
        border: primary ? 'none' : `1px solid ${ui.panelBorder}`,
        background: primary ? ui.accent : 'transparent',
        color: primary ? '#1a1206' : ui.text,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {action.label}
    </button>
  )
}

/**
 * The shared screen for every non-3D product state: loading, not found,
 * private/forbidden, rate-limited, token-required, network error, invalid
 * input, and the router's 404 (P6). Same tokens as the rest of the UI, a
 * tiny animated mark instead of a static icon.
 */
export function StateScreen({ eyebrow, title, children, action, secondaryAction, retryAt }: StateScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: ui.space(6),
        background: ui.bg,
        color: ui.text,
        fontFamily: ui.fontBody,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: ui.space(3), alignItems: 'center' }}>
        <PulseMark />
        {eyebrow && (
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: ui.textMuted }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.4rem', fontWeight: 600 }}>{title}</h1>
        {children && <div style={{ color: ui.textMuted, fontSize: '0.92rem', lineHeight: 1.5 }}>{children}</div>}
        {retryAt !== undefined && (
          <div style={{ color: ui.textMuted, fontSize: '0.85rem' }}>Resets around {formatDate(retryAt)}.</div>
        )}
        {(action || secondaryAction) && (
          <div style={{ display: 'flex', gap: ui.space(2), marginTop: ui.space(2), flexWrap: 'wrap', justifyContent: 'center' }}>
            {action && <ActionButton action={action} primary />}
            {secondaryAction && <ActionButton action={secondaryAction} />}
          </div>
        )}
      </div>
    </div>
  )
}
