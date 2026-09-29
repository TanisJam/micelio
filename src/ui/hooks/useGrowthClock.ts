import { useEffect, useMemo } from 'react'
import { easePlaybackProgress, mapPlaybackProgressToTime, type TimeBounds } from '../../domain/shared'

const AUTOPLAY_DURATION_MS = 10_000

export interface GrowthClock {
  /** Reads the current epoch-ms time. Safe to call every frame from `useFrame`; never triggers a React re-render. */
  getTime(): number
  getProgress(): number
  isPlaying(): boolean
  play(): void
  pause(): void
  toggle(): void
  /** Jumps to a linear playback fraction (0..1) and pauses auto-play. */
  seek(progress: number): void
  /** Registers a callback invoked once per animation frame while mounted (for UI that needs to re-render, e.g. the scrubber). Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void
  /** Cancels any pending animation frame. Call on unmount. */
  destroy(): void
}

/**
 * Drives the T5 growth time-lapse: an eased 0..1 playback progress that maps
 * onto `bounds` via `mapPlaybackProgressToTime`. Auto-plays once from first
 * event to now over ~10s on creation (skipped -- jumps straight to the end
 * -- when `reducedMotion` is set), and exposes imperative play/pause/seek
 * controls for the scrubber. Deliberately outside React state: the 3D scene
 * reads `getTime()` inside its own `useFrame` loop so growth animation never
 * triggers a React re-render of the (potentially large) tree.
 */
export function useGrowthClock(bounds: TimeBounds, reducedMotion: boolean, debugProgress: number | null): GrowthClock {
  const clock = useMemo<GrowthClock>(() => {
    let progress = debugProgress ?? (reducedMotion ? 1 : 0)
    let playing = debugProgress === null && !reducedMotion
    let rafId: number | null = null
    let lastFrameTime: number | null = null
    const subscribers = new Set<() => void>()

    function notify() {
      for (const callback of subscribers) callback()
    }

    function tick(now: number) {
      rafId = null
      if (!playing) return
      const dt = lastFrameTime === null ? 0 : now - lastFrameTime
      lastFrameTime = now
      progress = Math.min(1, progress + dt / AUTOPLAY_DURATION_MS)
      if (progress >= 1) {
        progress = 1
        playing = false
      }
      notify()
      scheduleIfPlaying()
    }

    function scheduleIfPlaying() {
      if (playing && rafId === null && typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(tick)
      }
    }

    return {
      getTime: () => mapPlaybackProgressToTime(easePlaybackProgress(progress), bounds),
      getProgress: () => progress,
      isPlaying: () => playing,
      play: () => {
        if (progress >= 1) progress = 0
        playing = true
        lastFrameTime = null
        notify()
        scheduleIfPlaying()
      },
      pause: () => {
        playing = false
        notify()
      },
      toggle: () => {
        if (playing) {
          playing = false
        } else {
          if (progress >= 1) progress = 0
          playing = true
          lastFrameTime = null
          scheduleIfPlaying()
        }
        notify()
      },
      seek: (next: number) => {
        progress = Math.min(1, Math.max(0, next))
        playing = false
        notify()
      },
      subscribe: (callback: () => void) => {
        subscribers.add(callback)
        return () => subscribers.delete(callback)
      },
      destroy: () => {
        playing = false
        if (rafId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      },
    }
    // `bounds`/`reducedMotion`/`debugProgress` seed the clock once; changing
    // repos remounts this whole tree branch (see `App`'s `key`), so the
    // clock intentionally doesn't react to them changing in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Kick the rAF loop if we start in a playing state.
    if (clock.isPlaying()) clock.play()
    return () => clock.destroy()
  }, [clock])

  return clock
}
