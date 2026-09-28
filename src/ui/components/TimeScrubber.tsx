import { useSyncExternalStore, type KeyboardEvent } from 'react'
import { mapPlaybackProgressToTime, type TimeBounds } from '../../domain/tree'
import type { GrowthClock } from '../hooks/useGrowthClock'
import { ui } from '../theme/tokens'

export interface TimeScrubberProps {
  clock: GrowthClock
  bounds: TimeBounds
}

const SEEK_STEP = 0.01

const dateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/**
 * Bottom time-lapse scrubber: play/pause, a range slider and the current
 * date. Keyboard accessible (space toggles play/pause, arrow keys scrub);
 * T7/T8 will restyle, this just needs to work and use the shared tokens.
 */
export function TimeScrubber({ clock, bounds }: TimeScrubberProps) {
  const progress = useSyncExternalStore(clock.subscribe, clock.getProgress)
  const playing = useSyncExternalStore(clock.subscribe, clock.isPlaying)
  const currentTime = mapPlaybackProgressToTime(progress, bounds)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      clock.toggle()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      clock.seek(clock.getProgress() - SEEK_STEP)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      clock.seek(clock.getProgress() + SEEK_STEP)
    }
  }

  return (
    <div
      role="group"
      aria-label="Growth time-lapse controls"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: ui.space(4),
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: ui.space(3),
        padding: `${ui.space(2)} ${ui.space(4)}`,
        borderRadius: ui.space(3),
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        color: ui.text,
        fontFamily: ui.fontBody,
        backdropFilter: 'blur(6px)',
        width: 'min(560px, calc(100vw - 32px))',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={() => clock.toggle()}
        aria-label={playing ? 'Pause growth time-lapse' : 'Play growth time-lapse'}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `1px solid ${ui.panelBorder}`,
          background: 'transparent',
          color: ui.text,
          cursor: 'pointer',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={(event) => clock.seek(Number.parseFloat(event.target.value))}
        aria-label="Growth timeline position"
        style={{ flex: 1, accentColor: ui.accent }}
      />

      <span style={{ flexShrink: 0, fontSize: '0.8rem', color: ui.textMuted, minWidth: '6.5em', textAlign: 'right' }}>
        {dateFormatter.format(currentTime)}
      </span>
    </div>
  )
}
