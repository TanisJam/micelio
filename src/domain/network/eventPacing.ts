/**
 * Unit 4 ("replay history event by event"): maps a linear 0..1 playback
 * progress onto an ACTIVITY-WEIGHTED timeline instead of pure calendar
 * time. Owner feedback: a linear clock wastes replay time on quiet
 * calendar stretches (e.g. a repo whose real activity is concentrated in a
 * handful of days out of years of history) and individual events aren't
 * noticeable when many of them land within the same few animation frames.
 *
 * The activity timeline is an inverted empirical CDF over every real event
 * time (rank-based, not time-density-based): N events are spread EVENLY
 * across the 0..1 progress range regardless of how close together or far
 * apart they actually happened, so a long silent gap is crossed just as
 * fast as a short one, and every event gets a real, non-zero minimum share
 * of total replay time (`1/(N-1)` of it, for N >= 2) -- a dense cluster of
 * near-simultaneous events can never squeeze any one of them toward zero
 * screen time. This is blended with a small amount of plain linear
 * (calendar) time so a real quiet gap still reads as a brief pause rather
 * than a full stop -- the date label shown alongside playback is always the
 * REAL resulting date, never fabricated.
 *
 * Pure -- no React, no three.js, no `Date.now()`.
 */
import { clamp } from '../math'
import { mapPlaybackProgressToTime } from '../shared/playback'
import type { TimeBounds } from '../shared/types'
import type { NetworkModel } from './types'

/** How much weight plain linear (calendar) time keeps in the final blend -- kept small and nonzero so quiet gaps still show as brief pauses, per the task brief. */
export const DEFAULT_LINEAR_BLEND_FRACTION = 0.18

/**
 * Every real, dated event the growth replay should pace itself by: a
 * hypha's own split (branch/PR created, or a direct-commit burst's first
 * commit) and, for anything that isn't still open, its end (merged/closed/
 * fused); every rendered commit node; every release. Deliberately reads
 * from the already-built `NetworkModel` (not the raw snapshot) so it
 * counts exactly the events the scene actually renders, including overflow-
 * capped repos, and needs no per-kind special-casing beyond what the model
 * already carries. Not deduplicated (several events can legitimately share
 * one exact timestamp) or pre-sorted -- see `sortedActivityEventTimes`.
 */
export function collectActivityEventTimes(model: NetworkModel): number[] {
  const times: number[] = []
  for (const hypha of model.hyphae) {
    if (hypha.kind === 'main') continue
    times.push(hypha.splitTime)
    if (hypha.status !== 'open') times.push(hypha.endTime)
  }
  for (const node of model.nodes) times.push(node.time)
  for (const mushroom of model.mushrooms) times.push(mushroom.time)
  return times.filter((t) => Number.isFinite(t))
}

/** `collectActivityEventTimes`, sorted ascending -- the shape `eventPacedTimeAtProgress` expects. */
export function sortedActivityEventTimes(model: NetworkModel): number[] {
  return collectActivityEventTimes(model).sort((a, b) => a - b)
}

/**
 * Inverts the rank-based empirical CDF over `sortedEventTimes` (already
 * ascending): the quantile-interpolated TIME at rank-fraction `progress`
 * (0..1). `null` for an empty list (nothing to pace by -- caller falls back
 * to pure linear time). Exact at both ends (`progress` 0 -> the first
 * event's own time, 1 -> the last), monotonically non-decreasing in
 * `progress` (linear interpolation between an ascending sequence), and for
 * N >= 2 events guarantees a `1/(N-1)` minimum progress-space gap between
 * any two consecutive distinct events' own positions -- honest degradation
 * for very large N: that per-event minimum share shrinks as N grows
 * (unavoidable within a fixed total replay duration), but it is never zero
 * and never depends on how close together the underlying events actually
 * happened in real time.
 */
export function eventPacedTimeAtProgress(sortedEventTimes: number[], progress: number): number | null {
  const n = sortedEventTimes.length
  if (n === 0) return null
  if (n === 1) return sortedEventTimes[0]!

  const clamped = clamp(progress, 0, 1)
  const scaled = clamped * (n - 1)
  const index = Math.min(n - 2, Math.floor(scaled))
  const localT = scaled - index
  const a = sortedEventTimes[index]!
  const b = sortedEventTimes[index + 1]!
  return a + (b - a) * localT
}

/**
 * The full Unit 4 mapping: activity-weighted time (see
 * `eventPacedTimeAtProgress`) blended with a small fraction of plain linear
 * time, clamped into `bounds` for safety (every growth-gate check elsewhere
 * assumes a time within `[firstEventTime, lastEventTime]`). Falls back to
 * pure linear time when there are no collected events at all (e.g. a
 * snapshot with no dated model elements beyond the spore).
 */
export function mapProgressToEventPacedTime(
  sortedEventTimes: number[],
  bounds: TimeBounds,
  progress: number,
  linearBlendFraction: number = DEFAULT_LINEAR_BLEND_FRACTION,
): number {
  const linear = mapPlaybackProgressToTime(progress, bounds)
  const eventPaced = eventPacedTimeAtProgress(sortedEventTimes, progress)
  if (eventPaced === null) return linear

  const blend = clamp(linearBlendFraction, 0, 1)
  const blended = eventPaced * (1 - blend) + linear * blend
  return clamp(blended, bounds.firstEventTime, bounds.lastEventTime)
}
