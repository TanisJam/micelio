import { useEffect, useMemo } from 'react'
import type { TimeBounds } from '../../domain/shared'
import { createGrowthClockController, type GrowthClock } from './growthClockController'

export type { GrowthClock } from './growthClockController'

/**
 * Drives the T5 growth time-lapse: an eased 0..1 playback progress that maps
 * onto `bounds`. Auto-plays once from first event to now over ~10s on
 * mount (skipped -- jumps straight to the end -- when `reducedMotion` is
 * set), and exposes imperative play/pause/seek controls for the scrubber.
 * Deliberately outside React state: the 3D scene reads `getTime()` inside
 * its own `useFrame` loop so growth animation never triggers a React
 * re-render of the (potentially large) network.
 *
 * The actual state machine lives in `createGrowthClockController`
 * (`growthClockController.ts`), which is plain and independently unit
 * tested. This hook only wires it into React's mount lifecycle -- and does
 * so carefully: `shouldAutoPlay` is captured once and never re-derived from
 * the clock's own runtime state, because `StrictMode` double-invokes the
 * mount effect in development (effect -> cleanup -> effect), and the
 * cleanup's `destroy()` always sets `playing = false`. A mount effect that
 * re-checked `clock.isPlaying()` before resuming would see `false` after
 * that synthetic cleanup and never call `play()` again -- silently killing
 * autoplay on every dev-mode load (the T8 regression this was fixed for).
 */
export function useGrowthClock(bounds: TimeBounds, reducedMotion: boolean, debugProgress: number | null): GrowthClock {
  const shouldAutoPlay = debugProgress === null && !reducedMotion
  const initialProgress = debugProgress ?? (reducedMotion ? 1 : 0)

  const clock = useMemo<GrowthClock>(
    () => createGrowthClockController(bounds, initialProgress, shouldAutoPlay),
    // `bounds`/`initialProgress`/`shouldAutoPlay` seed the clock once; changing
    // repos remounts this whole tree branch (see `App`'s `key`), so the
    // clock intentionally doesn't react to them changing in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    // Resume based on the ORIGINAL autoplay intent, never on the clock's
    // current `isPlaying()` -- see the doc comment above for why.
    if (shouldAutoPlay) clock.play()
    return () => clock.destroy()
  }, [clock, shouldAutoPlay])

  return clock
}
