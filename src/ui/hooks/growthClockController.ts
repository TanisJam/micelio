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

export interface GrowthClockScheduler {
  now(): number
  requestFrame(callback: (time: number) => void): number
  cancelFrame(id: number): void
}

const defaultScheduler: GrowthClockScheduler = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  requestFrame: (callback) =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : -1,
  cancelFrame: (id) => {
    if (id !== -1 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  },
}

/**
 * Pure (no React) growth-clock state machine: an eased 0..1 playback
 * progress advanced via a scheduler's animation-frame loop. Extracted from
 * `useGrowthClock` so the state machine itself -- including the
 * play/destroy/play-again sequence React's `StrictMode` performs on every
 * initial mount in development (effect -> cleanup -> effect) -- is directly
 * unit-testable without a DOM/React renderer.
 *
 * `destroy()` always stops playback (`playing = false`) so a real unmount
 * can't leave a stray animation frame running. Because of that, callers
 * must NOT gate a subsequent `play()` call on `isPlaying()` -- that was the
 * root cause of a real bug (see `useGrowthClock.ts`): after `StrictMode`'s
 * synthetic first-mount cleanup calls `destroy()`, `isPlaying()` is already
 * `false`, so a mount effect written as `if (isPlaying()) play()` silently
 * never restarts the clock and growth autoplay never advances. Callers
 * should instead resume based on an autoplay intent decided once at
 * creation time (`shouldAutoPlay`, unaffected by `destroy()`), independent
 * of the clock's current runtime state.
 *
 * Creation itself never schedules a frame (`shouldAutoPlay` only seeds the
 * `playing` flag) -- scheduling is a side effect and must be triggered
 * explicitly by the caller's mount effect (calling `play()`), never as a
 * side effect of construction, since `React.StrictMode` in development can
 * invoke a `useMemo` factory more than once per render and any real
 * `requestAnimationFrame` scheduled during that extra, discarded call would
 * never be cancelled.
 */
export function createGrowthClockController(
  bounds: TimeBounds,
  initialProgress: number,
  shouldAutoPlay: boolean,
  scheduler: GrowthClockScheduler = defaultScheduler,
): GrowthClock {
  let progress = initialProgress
  let playing = shouldAutoPlay
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
    if (playing && rafId === null) {
      rafId = scheduler.requestFrame(tick)
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
      if (rafId !== null) {
        scheduler.cancelFrame(rafId)
        rafId = null
      }
    },
  }
}
