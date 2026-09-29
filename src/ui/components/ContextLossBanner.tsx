import { ui } from '../theme/tokens'

export interface ContextLossBannerProps {
  onReload: () => void
}

/**
 * B4/T8: shown when the 3D scene's `webglcontextlost` event fires (driver
 * crash, the OS reclaiming VRAM under memory pressure, too many WebGL
 * contexts open in other tabs, etc). Small and centered rather than a full
 * error/state screen -- the rest of the UI (header, legend, scrubber) is
 * still perfectly functional, only the canvas itself has gone blank/frozen.
 */
export function ContextLossBanner({ onReload }: ContextLossBannerProps) {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: ui.space(3),
        maxWidth: 'min(360px, calc(100vw - 32px))',
        textAlign: 'center',
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(3),
        color: ui.text,
        fontFamily: ui.fontBody,
        padding: ui.space(5),
        backdropFilter: 'blur(6px)',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>The galaxy lost its GPU context.</span>
      <button
        type="button"
        onClick={onReload}
        style={{
          background: 'transparent',
          border: `1px solid ${ui.panelBorder}`,
          borderRadius: ui.space(2),
          color: ui.accent,
          cursor: 'pointer',
          padding: `${ui.space(2)} ${ui.space(4)}`,
          fontFamily: ui.fontBody,
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        Reload view
      </button>
    </div>
  )
}
