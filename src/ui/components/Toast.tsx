import { ui } from '../theme/tokens'

export interface ToastProps {
  message: string | null
}

/** A small bottom-anchored confirmation message (e.g. "Link copied"). Renders nothing while `message` is null. */
export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: ui.space(20),
        transform: 'translateX(-50%)',
        zIndex: 40,
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(3),
        color: ui.text,
        fontFamily: ui.fontBody,
        fontSize: '0.85rem',
        padding: `${ui.space(2)} ${ui.space(4)}`,
        backdropFilter: 'blur(6px)',
      }}
    >
      {message}
    </div>
  )
}
