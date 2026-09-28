import { clamp, easeInOutCubic, easeOutCubic } from '../math'
import type { Limb, TimeBounds, Twig } from './types'

/**
 * Pure growth-progress functions driving the T5 time-lapse replay. Every
 * function here is a deterministic mapping from (element, currentTime) to a
 * 0..1 progress or scale value: monotonic in `currentTime`, clamped to
 * [0, 1], and exactly 0 before an element's birth time / 1 once fully grown.
 * No React, no three.js, no Date.now() -- `currentTime` is always passed in.
 */

/** Fraction of the total time span a twig takes to sprout to full length. */
const TWIG_GROW_FRACTION = 0.015
/** Fraction of the total time span a leaf/fruit/flower/bud takes to pop in. */
const POP_FRACTION = 0.02
const MIN_DURATION_MS = 1

function totalSpan(bounds: TimeBounds): number {
  return Math.max(bounds.lastEventTime - bounds.firstEventTime, MIN_DURATION_MS)
}

/** Trunk height reveal: 0 at the first event, 1 once `currentTime` reaches the last trunk segment's time. */
export function trunkGrowthProgress(
  trunk: { segments: { time: number }[] },
  currentTime: number,
): number {
  if (trunk.segments.length === 0) return 1
  const first = trunk.segments[0]!.time
  const last = trunk.segments[trunk.segments.length - 1]!.time
  if (last <= first) return currentTime >= last ? 1 : 0
  return clamp((currentTime - first) / (last - first), 0, 1)
}

/**
 * The time at which a limb is fully drawn: its last twig's time, or a short
 * default window past the era start for a limb with no twigs. Exposed so
 * overflow leaves (scattered at a random position along the limb, not tied
 * to any single twig -- see `buildOverflowLeaves`) can gate on it directly:
 * unlike a twig-anchored leaf, an overflow leaf's position doesn't
 * correlate with twig order, so the only time it's *always* safe to show
 * one is once the whole limb has finished growing.
 */
export function limbFullyGrownTime(limb: Limb, twigs: Twig[], bounds: TimeBounds): number {
  const limbTwigs = twigs.filter((twig) => twig.limbId === limb.id)
  if (limbTwigs.length === 0) {
    return limb.time + totalSpan(bounds) * TWIG_GROW_FRACTION * 4
  }
  return limbTwigs.reduce((max, twig) => Math.max(max, twig.time), limb.time)
}

/**
 * A limb's drawn length tracks how many of its twigs (in position order,
 * which always matches merge-time order -- see `buildLimb`/`buildTwig`)
 * have already sprouted, rather than a smooth time ratio across the era.
 * This is deliberate: a twig's position along the limb's polyline is
 * `index / (twigCount - 1)`, so revealing the limb by *twig count* rather
 * than by *elapsed time* guarantees the limb is always drawn at least as
 * far as any twig that has already popped -- a smooth time-based ratio can
 * fall behind when merges cluster unevenly within an era, leaving twigs
 * (and their leaves) visibly floating past the limb's current tip.
 */
export function limbGrowthProgress(limb: Limb, twigs: Twig[], bounds: TimeBounds, currentTime: number): number {
  if (currentTime < limb.time) return 0

  const limbTwigs = twigs.filter((twig) => twig.limbId === limb.id)

  if (limbTwigs.length === 0) {
    const endTime = limbFullyGrownTime(limb, twigs, bounds)
    return clamp((currentTime - limb.time) / (endTime - limb.time), 0, 1)
  }

  const grown = limbTwigs.reduce((count, twig) => (twig.time <= currentTime ? count + 1 : count), 0)
  return clamp(grown / limbTwigs.length, 0, 1)
}

/** A twig sprouts from its limb over a short, eased window starting at its own time (PR mergedAt). */
export function twigGrowthProgress(twig: { time: number }, bounds: TimeBounds, currentTime: number): number {
  const duration = totalSpan(bounds) * TWIG_GROW_FRACTION
  const linear = clamp((currentTime - twig.time) / duration, 0, 1)
  return easeOutCubic(linear)
}

/**
 * Generic pop-in scale (0..1, eased) for leaves/fruit/flowers/buds: 0 before
 * `elementTime`, eases up to 1 over a short window relative to the model's
 * total time span.
 */
export function popScale(elementTime: number, bounds: TimeBounds, currentTime: number): number {
  const duration = totalSpan(bounds) * POP_FRACTION
  const linear = clamp((currentTime - elementTime) / duration, 0, 1)
  return easeOutCubic(linear)
}

/**
 * Maps an eased auto-play progress (0..1) to an absolute epoch time within
 * `bounds`. Monotonic in `progress`, clamped, and exact at both ends.
 */
export function mapPlaybackProgressToTime(progress: number, bounds: TimeBounds): number {
  const clamped = clamp(progress, 0, 1)
  return bounds.firstEventTime + clamped * (bounds.lastEventTime - bounds.firstEventTime)
}

/** Applies the standard auto-play easing curve to a linear 0..1 playback progress. */
export function easePlaybackProgress(linearProgress: number): number {
  return easeInOutCubic(linearProgress)
}
