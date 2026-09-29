import { useState, useSyncExternalStore } from 'react'
import type { GrowthClock } from '../hooks/useGrowthClock'
import { ui } from '../theme/tokens'
import { captionForProgress, shouldShowCaption } from './growthCaptionLogic'

export interface GrowthCaptionProps {
  clock: GrowthClock
  /** Never rendered under `prefers-reduced-motion` -- growth doesn't animate then (it jumps straight to the end), so there's no replay for this caption to narrate (A5/T8). */
  reducedMotion: boolean
}

/**
 * A short, quiet, dismissible caption synced to the growth replay (A5/T8
 * "first-visit legibility"): explains the data mapping in plain language
 * while autoplay is still running, then fades away on its own once autoplay
 * finishes (`progress >= 1`) or the visitor dismisses it -- whichever comes
 * first. Only ever shown once per page load (autoplay itself only ever runs
 * once), so it never nags a returning/already-oriented visitor mid-session.
 */
export function GrowthCaption({ clock, reducedMotion }: GrowthCaptionProps) {
  const progress = useSyncExternalStore(clock.subscribe, clock.getProgress)
  const [dismissed, setDismissed] = useState(false)

  if (!shouldShowCaption(progress, reducedMotion, dismissed)) return null
  const caption = { text: captionForProgress(progress) }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        // Centered directly above the `TimeScrubber` (never rendered
        // alongside it, see `ViewerPage`) -- keeps clear of the top-left
        // Legend/top-right Explore-list buttons at every viewport width,
        // including narrow mobile where a top-centered placement would
        // otherwise collide with the Legend panel.
        bottom: 92,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 22,
        display: 'flex',
        alignItems: 'center',
        gap: ui.space(2),
        maxWidth: 'min(400px, calc(100vw - 32px))',
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(3),
        color: ui.text,
        fontFamily: ui.fontBody,
        fontSize: '0.8rem',
        padding: `${ui.space(2)} ${ui.space(2)} ${ui.space(2)} ${ui.space(3)}`,
        backdropFilter: 'blur(6px)',
      }}
    >
      <span>{caption.text}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss caption"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: ui.textMuted,
          cursor: 'pointer',
          fontSize: '0.9rem',
          lineHeight: 1,
          padding: ui.space(1),
        }}
      >
        ×
      </button>
    </div>
  )
}
