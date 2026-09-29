import { clamp, easeInOutCubic } from '../math'
import type { TimeBounds } from './types'

/**
 * Pure growth-replay playback helpers, metaphor-agnostic (moved out of the
 * removed `../tree/growth.ts` in M4 -- every OTHER function that lived there
 * was tree-geometry-specific and had no surviving caller). No React, no
 * three.js, no `Date.now()` -- `progress`/`currentTime` are always passed in.
 */

/** Maps a linear 0..1 playback progress to an actual epoch-ms time within `bounds`. Monotonic in `progress`, clamped, and exact at both ends. */
export function mapPlaybackProgressToTime(progress: number, bounds: TimeBounds): number {
  const clamped = clamp(progress, 0, 1)
  return bounds.firstEventTime + clamped * (bounds.lastEventTime - bounds.firstEventTime)
}

/** Applies the standard auto-play easing curve to a linear 0..1 playback progress. */
export function easePlaybackProgress(linearProgress: number): number {
  return easeInOutCubic(linearProgress)
}
