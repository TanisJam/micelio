import { clamp, lerp, logScale } from '../math'
import type { TimeBounds } from '../shared/types'
import { normalizeVec3, subVec3, vec3, type Vec3 } from '../shared/vector'
import type { HyphaPoint } from './types'

/**
 * Shared disc/time geometry helpers used by the colony layout
 * (`colonyLayout.ts`), the mushroom placement (`mushrooms.ts`) and the M3
 * render-hints helpers (`renderHints.ts`). Split out of the removed spiral
 * layout module (`layout.ts`, M4 -- colony is the only layout now) since
 * these particular pieces have nothing spiral-specific about them: radius-
 * from-time mapping, a disc-radius lookup along an already-positioned
 * hypha's own curve, and the shared node/PR-thickness/cap helpers.
 */

export interface LayoutOptions {
  /** Rendered commit/merge-point nodes kept per hypha, most representative subset; default 60. */
  maxNodesPerHypha: number
  /**
   * Total extra rotation (radians) applied at the disc's outer rim, tapering
   * to 0 at the spore -- bends the colony's radial growth into galaxy-like
   * spiral arms (product direction: "luminous spiral galaxy made of
   * mycelium"). `0` disables it entirely. See `colonyLayout.ts`'s
   * `applySwirl`.
   */
  swirl: number
  /** How fast the swirl ramps up with radius -- `(r/R)^swirlPower`. Higher = swirl stays near 0 longer near the spore, then sweeps harder near the rim. */
  swirlPower: number
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  maxNodesPerHypha: 60,
  swirl: 1.6,
  swirlPower: 1.4,
}

/** The colony disc's own bounding radius (world units). */
export const DISC_MAX_RADIUS = 5
/** < 1: early history gets proportionally more radius per unit time, so it isn't crushed near the spore. */
const RADIUS_EASE_EXPONENT = 0.58
const SIDE_MIN_RADIUS = 0.012
const SIDE_MAX_RADIUS = 0.045

export function timeToFrac(time: number, bounds: TimeBounds): number {
  const span = bounds.lastEventTime - bounds.firstEventTime
  if (span <= 0) return 0
  return clamp((time - bounds.firstEventTime) / span, 0, 1)
}

/**
 * Eased pure-time radius mapping: `DISC_MAX_RADIUS * frac^RADIUS_EASE_EXPONENT`.
 * Exported for tests (e.g. checking loops never cross the next spiral turn,
 * back when the spiral layout existed) and UI reuse.
 */
export function radiusForFrac(frac: number): number {
  const clamped = clamp(frac, 0, 1)
  return DISC_MAX_RADIUS * Math.pow(clamped, RADIUS_EASE_EXPONENT)
}

export function radiusForCommitCount(commitCount: number): number {
  return lerp(SIDE_MIN_RADIUS, SIDE_MAX_RADIUS, logScale(commitCount, 0, 200))
}

/** Disc (XZ-plane) distance from the origin, ignoring `y` -- the colony layout's (M2d) notion of "radius" for gap-finding/growth, distinct from a `HyphaPoint.radius` (tube thickness). */
export function discRadius(position: Vec3): number {
  return Math.hypot(position.x, position.z)
}

/**
 * Unit 3/4: locates a positioned hypha's own polyline position at a given
 * TIME (epoch ms), interpolating between its points' own `.time` values --
 * the time-keyed counterpart of `pointOnHyphaAtRadius`'s radius-keyed
 * lookup, used to place a "growth front" glow point that travels outward
 * along a hypha as it grows, in real (eased) playback time rather than by
 * radius or commit index. Clamps to the nearest end outside `[splitTime,
 * endTime]`, an honest "as far as this hypha has grown", not extrapolation.
 * `null` for a hypha with fewer than 2 points (nothing to travel along).
 */
export function pointOnHyphaAtTime(points: HyphaPoint[], time: number): Vec3 | null {
  if (points.length < 2) return null

  const first = points[0]!
  const last = points[points.length - 1]!
  const clamped = clamp(time, Math.min(first.time, last.time), Math.max(first.time, last.time))

  let index = 1
  while (index < points.length - 1 && points[index]!.time < clamped) index += 1
  const a = points[index - 1]!
  const b = points[index]!
  const span = b.time - a.time
  const localT = span > 1e-9 ? (clamped - a.time) / span : 0

  return {
    x: a.position.x + (b.position.x - a.position.x) * localT,
    y: a.position.y + (b.position.y - a.position.y) * localT,
    z: a.position.z + (b.position.z - a.position.z) * localT,
  }
}

/**
 * Locates the position/disc-radius/tangent-angle of a positioned hypha's
 * curve at an arbitrary DISC RADIUS (not time), clamped into its own
 * start/end radius range -- the M2d colony layout's radius-keyed counterpart
 * of a time-keyed lookup. Points are assumed non-decreasing in disc radius
 * along the array (true for every colony-grown hypha by construction). When
 * `targetRadius` falls outside the hypha's own span (e.g. a real
 * branch-from-branch child whose time-based attach radius outruns its real
 * parent's own, shorter, work-driven length), the result clamps to the
 * nearest end -- an honest "as far as this hypha actually reaches", not a
 * fabricated extrapolation.
 */
export function pointOnHyphaAtRadius(points: HyphaPoint[], targetRadius: number): { position: Vec3; radius: number; tangentAngle: number | null } {
  if (points.length === 0) {
    return { position: vec3(0, 0, 0), radius: 0, tangentAngle: null }
  }
  if (points.length === 1) {
    return { position: points[0]!.position, radius: discRadius(points[0]!.position), tangentAngle: null }
  }

  // Deliberately avoids `points.map(discRadius)` (an allocation-per-call
  // that showed up in the colony layout's perf budget for large repos, see
  // `buildNetwork.test.ts`'s 1000-PR case): a plain forward scan, since
  // radius is guaranteed non-decreasing along `points` by construction.
  const firstRadius = discRadius(points[0]!.position)
  const lastRadius = discRadius(points[points.length - 1]!.position)
  const clamped = clamp(targetRadius, firstRadius, lastRadius)

  let index = 1
  let ra = firstRadius
  let rb = discRadius(points[1]!.position)
  while (rb < clamped && index < points.length - 1) {
    index += 1
    ra = rb
    rb = discRadius(points[index]!.position)
  }
  const a = points[index - 1]!
  const b = points[index]!
  const span = rb - ra
  const localT = span > 1e-9 ? (clamped - ra) / span : 0

  const position = {
    x: a.position.x + (b.position.x - a.position.x) * localT,
    y: a.position.y + (b.position.y - a.position.y) * localT,
    z: a.position.z + (b.position.z - a.position.z) * localT,
  }
  const tangent = normalizeVec3(subVec3(b.position, a.position))
  return { position, radius: discRadius(position), tangentAngle: Math.atan2(tangent.z, tangent.x) }
}

/** Picks an evenly-spaced representative subset (always including the first and last), honestly recording the rest as overflow. */
export function capEvenly<T>(items: T[], max: number): { kept: T[]; omitted: number } {
  if (items.length <= max || max <= 0) return { kept: items, omitted: Math.max(0, items.length - Math.max(max, 0)) }
  if (max === 1) return { kept: [items[0]!], omitted: items.length - 1 }
  const kept: T[] = []
  for (let i = 0; i < max; i++) {
    const index = Math.round((i * (items.length - 1)) / (max - 1))
    kept.push(items[index]!)
  }
  return { kept, omitted: items.length - kept.length }
}

