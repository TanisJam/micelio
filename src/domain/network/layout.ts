import { clamp, lerp, logScale } from '../math'
import { createPrng, randJitter, randRange, type Prng } from '../tree/prng'
import type { TimeBounds } from '../tree/types'
import {
  addVec3,
  normalizeVec3,
  scaleVec3,
  subVec3,
  vec3,
  type Vec3,
} from '../tree/vector'
import { sampleCatmullRomCentripetal, type SplineControlPoint } from './spline'
import type { HyphaDraft } from './topology'
import type { Hair, Hypha, HyphaPoint, NetworkNode, NetworkRef, Spore, Tip } from './types'

/**
 * Turns the pure topology (`topology.ts`) into positioned geometry: the
 * main hypha spirals outward from the spore (XZ disc, radius encodes time);
 * every other hypha leaves its parent's curve at the split point, bows out
 * by a lane offset, and either rejoins (merged), drifts to a droop (closed)
 * or ends at a growing tip (open/live branch). No React, no three.js.
 */

export interface LayoutOptions {
  /** Rendered commit/merge-point nodes kept per hypha, most representative subset; default 60. */
  maxNodesPerHypha: number
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  maxNodesPerHypha: 60,
}

// --- Disc / spiral tuning -----------------------------------------------
/** Shared with the colony layout (`colonyLayout.ts`) so both disc-based layouts render at the same real-world scale for side-by-side comparison. */
export const DISC_MAX_RADIUS = 5
/** < 1: early history gets proportionally more radius per unit time, so it isn't crushed near the spore. */
const RADIUS_EASE_EXPONENT = 0.58
export const SPIRAL_TURNS = 2.1
const MAIN_Y = 0
const MAIN_Y_JITTER = 0.05
const MAIN_CONTROL_POINTS = 48
const MAIN_SAMPLES_PER_SEGMENT = 5
const MAIN_THICKNESS_MIN = 0.03
const MAIN_THICKNESS_MAX = 0.11
const MAIN_XZ_JITTER = 0.045
// Radius blends a (eased) pure-time fraction with a cumulative-activity
// fraction (see `buildActivityCdf`): TIME_WEIGHT alone would crush loops
// into the empty stretches between turns during bursty development and
// starve quiet stretches of any turn-to-turn room at all; ACTIVITY_WEIGHT
// makes the spiral itself widen its pitch exactly where commit/PR activity
// is dense, so loops (which are capped by that pitch) get more room to bow
// exactly where there are more of them. Both components are individually
// monotonically non-decreasing in time, and the blend is a positively
// weighted sum of the two, so the result stays monotonically non-decreasing
// outward -- "distance from center" is still an honest (if now
// density-weighted, not purely linear) proxy for time. See the M2b progress
// notes for the visual-iteration rationale.
const RADIUS_TIME_WEIGHT = 0.58
const RADIUS_ACTIVITY_WEIGHT = 1 - RADIUS_TIME_WEIGHT

// --- Side-hypha tuning -----------------------------------------------
const SIDE_INTERIOR_CONTROL_POINTS = 4
const SIDE_SAMPLES_PER_SEGMENT = 7
export const SPIRAL_PITCH_SAFETY = 0.46
const MIN_PITCH_FLOOR = DISC_MAX_RADIUS * 0.015
export const NESTED_MAX_LANE_DEPTH = 0.35
/**
 * A hard ceiling on loop depth regardless of how much local spiral pitch is
 * technically available. The first turn or two near the spore can have a
 * huge pitch (the sub-linear radius ease front-loads a lot of the disc's
 * radius into very little time there), which -- without this cap -- let
 * loops balloon into a chaotic "sea urchin" burst near the center instead
 * of reading as calm, lens-shaped eyes (round-1 visual iteration finding,
 * see the M2b progress notes).
 */
const ABSOLUTE_MAX_LOOP_DEPTH = 0.3
const SIDE_MIN_RADIUS = 0.012
const SIDE_MAX_RADIUS = 0.045
// A loop's lateral "depth" (how far it bows from its parent) is driven by
// the *available* room (a fraction of the local spiral pitch, or the fixed
// nested cap), not a fixed absolute size -- see `computeLoopDepth`: a
// minimum fraction of that room is always used (a visible bulge even for a
// single-commit PR), growing with the PR's own weight (commit count) and
// with its lane index (so concurrent same-side siblings fan out instead of
// stacking on the same offset), but never exceeding the available room.
const MIN_BULGE_FRACTION = 0.24
const WEIGHT_BULGE_FRACTION = 0.32
const LANE_GROWTH_FRACTION = 0.2
const WEIGHT_SATURATION_COMMITS = 40
/** Small per-loop rotation applied to the bow direction itself (on top of the alternating side), so concurrent same-side loops fan out into organically varied angles instead of a rigid parallel "comb". */
const BOW_ANGLE_JITTER = 0.35
// A fraction of each loop's own `depth`, not an absolute magnitude -- a
// short/tight loop gets proportionally gentle wiggle instead of jitter big
// enough to swamp its own bow and read as a noisy scribble.
const SIDE_JITTER_FRACTION = 0.22
export const SIDE_JITTER_MAX = 0.02
const DEAD_END_LENGTH_MIN = 0.15
const DEAD_END_LENGTH_MAX = 0.4
const DEAD_END_DROOP = 0.22
const OPEN_LENGTH_MIN = 0.18
const OPEN_LENGTH_MAX = 0.55
const OPEN_LIFT = 0.06
/** Forward (tangential) departure never exceeds this fraction of the loop's own lateral depth, so a dead end/open tip stays compact and never reads as a spoke. */
const FORWARD_REACH_DEPTH_FRACTION = 0.8
const FORWARD_REACH_LENGTH_FRACTION = 0.35

// --- Hair (mycelial texture) tuning -------------------------------------
const HAIR_LENGTH_FACTOR = 2.2
const HAIR_LENGTH_MIN = 0.018
const HAIR_LENGTH_MAX = 0.05
const HAIR_LENGTH_JITTER = 0.008
const HAIR_MIN_LENGTH_FLOOR = 0.006
const HAIR_BASE_RADIUS_FRACTION = 0.35
const HAIR_MIN_BASE_RADIUS = 0.0015
/** Radians -- jitter applied on top of the strict alternating-side perpendicular direction. */
const HAIR_ANGLE_JITTER = 0.5
const HAIR_Y_TILT = 0.12
/** A merge-point commit's hair reads slightly longer, reinforcing its fusion "knot" without inventing a separate element. */
const HAIR_MERGE_LENGTH_BOOST = 1.6

export interface LaneAssignment {
  lane: number
  side: -1 | 1
}

/**
 * Greedy interval scheduling per parent, alternating sides to balance the
 * disc: a running per-parent counter picks the side (even -> +1, odd -> -1)
 * for each new child in split-time order, then each side gets its own
 * independent lane track (earliest-available lane whose last-assigned
 * interval already ended before this child starts).
 */
export function assignLanes(hyphaeByParent: Map<string, HyphaDraft[]>): Map<string, LaneAssignment> {
  const result = new Map<string, LaneAssignment>()

  for (const children of hyphaeByParent.values()) {
    const sorted = [...children].sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))
    const laneEndBySide: Record<'-1' | '1', number[]> = { '-1': [], '1': [] }
    let sideCounter = 0

    for (const child of sorted) {
      const side: -1 | 1 = sideCounter % 2 === 0 ? 1 : -1
      sideCounter += 1
      const laneEnds = laneEndBySide[side === 1 ? '1' : '-1']

      let laneIndex = laneEnds.findIndex((end) => end <= child.splitTime)
      if (laneIndex === -1) {
        laneIndex = laneEnds.length
        laneEnds.push(child.endTime)
      } else {
        laneEnds[laneIndex] = child.endTime
      }

      result.set(child.id, { lane: laneIndex, side })
    }
  }

  return result
}

export function timeToFrac(time: number, bounds: TimeBounds): number {
  const span = bounds.lastEventTime - bounds.firstEventTime
  if (span <= 0) return 0
  return clamp((time - bounds.firstEventTime) / span, 0, 1)
}

/** A cumulative-activity fraction: `activity(frac)` is the share of real events (commits/split points) at or before `frac`. Monotonically non-decreasing by construction (a CDF), 0 at frac 0, 1 at frac 1. */
export type ActivityCdf = (frac: number) => number

/**
 * Builds the activity CDF driving the density-weighted radius mapping (see
 * `RADIUS_ACTIVITY_WEIGHT` above): one event per main direct-commit time,
 * one per side hypha's own split (its real "birth" as a branch-off), and
 * one per side-hypha commit -- so a burst of concurrent, commit-heavy PRs
 * genuinely advances the CDF faster than a quiet stretch, without needing
 * any data beyond what's already in the drafts.
 */
export function buildActivityCdf(main: HyphaDraft, hyphae: HyphaDraft[], bounds: TimeBounds): ActivityCdf {
  const fracs: number[] = []
  for (const commit of main.commits) fracs.push(timeToFrac(commit.time, bounds))
  for (const draft of hyphae) {
    fracs.push(timeToFrac(draft.splitTime, bounds))
    for (const commit of draft.commits) fracs.push(timeToFrac(commit.time, bounds))
  }
  fracs.sort((a, b) => a - b)

  if (fracs.length === 0) {
    return (frac: number) => clamp(frac, 0, 1)
  }

  return (frac: number): number => {
    const clamped = clamp(frac, 0, 1)
    let low = 0
    let high = fracs.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (fracs[mid]! <= clamped) low = mid + 1
      else high = mid
    }
    return low / fracs.length
  }
}

/** Exported for tests (e.g. checking loops never cross the next spiral turn) and potential UI reuse. `activity` blends in density-weighted room; omit it to fall back to the pure eased-time mapping. */
export function radiusForFrac(frac: number, activity?: ActivityCdf): number {
  const clamped = clamp(frac, 0, 1)
  const timeComponent = Math.pow(clamped, RADIUS_EASE_EXPONENT)
  const activityComponent = activity ? activity(clamped) : timeComponent
  const blended = RADIUS_TIME_WEIGHT * timeComponent + RADIUS_ACTIVITY_WEIGHT * activityComponent
  return DISC_MAX_RADIUS * blended
}

/** Radius gained over one full spiral turn (2*pi) starting at `frac` -- used to cap lane bow so loops never cross the next winding. */
export function localSpiralPitch(frac: number, activity?: ActivityCdf): number {
  const nextFrac = Math.min(1, frac + 1 / SPIRAL_TURNS)
  const pitch = radiusForFrac(nextFrac, activity) - radiusForFrac(frac, activity)
  return Math.max(pitch, MIN_PITCH_FLOOR)
}

interface MainPointBasis {
  position: Vec3
  radius: number
  time: number
}

function buildMainControlPoints(bounds: TimeBounds, rotationOffset: number, prng: Prng, activity: ActivityCdf): MainPointBasis[] {
  const points: MainPointBasis[] = []
  for (let i = 0; i <= MAIN_CONTROL_POINTS; i++) {
    const t = i / MAIN_CONTROL_POINTS
    const time = lerp(bounds.firstEventTime, bounds.lastEventTime, t)
    const radius = radiusForFrac(t, activity)
    const angle = rotationOffset + SPIRAL_TURNS * Math.PI * 2 * t
    const tangentAngle = angle + Math.PI / 2
    const jitterMag = MAIN_XZ_JITTER * t
    const jitter = randJitter(prng, jitterMag)
    const position = vec3(
      Math.cos(angle) * radius + Math.cos(tangentAngle) * jitter,
      MAIN_Y + randJitter(prng, MAIN_Y_JITTER * t),
      Math.sin(angle) * radius + Math.sin(tangentAngle) * jitter,
    )
    points.push({ position, radius: lerp(MAIN_THICKNESS_MAX, MAIN_THICKNESS_MIN, t), time })
  }
  return points
}

/** Locates the position/radius/tangent of a positioned hypha's curve at an arbitrary time, clamped into its own range. */
export function pointOnHyphaAtTime(points: HyphaPoint[], time: number): { position: Vec3; radius: number; tangent: Vec3 } {
  if (points.length === 0) {
    return { position: vec3(0, 0, 0), radius: 0, tangent: vec3(0, 0, 1) }
  }
  if (points.length === 1) {
    return { position: points[0]!.position, radius: points[0]!.radius, tangent: vec3(0, 0, 1) }
  }

  const clamped = clamp(time, points[0]!.time, points[points.length - 1]!.time)
  let index = points.findIndex((p) => p.time >= clamped)
  if (index <= 0) index = 1
  const a = points[index - 1]!
  const b = points[index]!
  const span = b.time - a.time
  const localT = span > 1e-6 ? (clamped - a.time) / span : 0

  return {
    position: {
      x: a.position.x + (b.position.x - a.position.x) * localT,
      y: a.position.y + (b.position.y - a.position.y) * localT,
      z: a.position.z + (b.position.z - a.position.z) * localT,
    },
    radius: lerp(a.radius, b.radius, localT),
    tangent: normalizeVec3(subVec3(b.position, a.position)),
  }
}

export function radiusForCommitCount(commitCount: number): number {
  return lerp(SIDE_MIN_RADIUS, SIDE_MAX_RADIUS, logScale(commitCount, 0, 200))
}

/** sin(pi*t): 0 at both ends, peak at the middle -- used so a fused loop leaves and rejoins its parent tangent-continuously. */
function symmetricEnvelope(t: number): number {
  return Math.sin(Math.PI * clamp(t, 0, 1))
}

/** sin(pi*t/2): 0 at the split end, 1 at the free (dead-end/open) end -- no continuity constraint needed there. */
function openEndEnvelope(t: number): number {
  return Math.sin((Math.PI / 2) * clamp(t, 0, 1))
}

export interface PositionedHyphaResult {
  hypha: Hypha
  points: HyphaPoint[]
}

/**
 * How far (world units) a loop/dead-end/open hypha bows away from its
 * parent's own curve. Driven by the room actually available at this attach
 * point (a fraction of the local spiral pitch when the parent is main, or a
 * fixed nested cap otherwise) rather than a fixed absolute size: a minimum
 * fraction of that room is always used (so even a single-commit PR reads as
 * a visible bulge, never a "tiny tick"), growing with the PR's own weight
 * (commit count, log-saturating) and its lane index (so concurrent
 * same-side siblings fan out into their own room instead of stacking), but
 * never exceeding the available room -- which is exactly what guarantees a
 * main-parented loop can never cross the next spiral winding.
 */
function computeLoopDepth(
  draft: HyphaDraft,
  laneAssignment: LaneAssignment,
  attachPosition: Vec3,
  parentFrac: number,
  isOnMain: boolean,
  activity: ActivityCdf,
): number {
  let roomCap = isOnMain ? localSpiralPitch(parentFrac, activity) * SPIRAL_PITCH_SAFETY : NESTED_MAX_LANE_DEPTH
  if (isOnMain) {
    // Near the disc's outer edge (newest history) there is no further
    // winding to avoid crossing, but a loop still must not visually poke
    // past the disc's own outer boundary -- cap depth by remaining radial
    // room too, not just the (otherwise near-zero) next-turn pitch.
    const attachRadius = Math.sqrt(attachPosition.x * attachPosition.x + attachPosition.z * attachPosition.z)
    const remainingRoom = Math.max(0.02, DISC_MAX_RADIUS - attachRadius)
    roomCap = Math.min(roomCap, remainingRoom, ABSOLUTE_MAX_LOOP_DEPTH)
  }

  const weightFactor = logScale(draft.commitCount, 0, WEIGHT_SATURATION_COMMITS)
  const minBulge = roomCap * MIN_BULGE_FRACTION
  const weightBulge = roomCap * WEIGHT_BULGE_FRACTION * weightFactor
  const laneGrowth = laneAssignment.lane * roomCap * LANE_GROWTH_FRACTION
  return Math.min(minBulge + weightBulge + laneGrowth, roomCap)
}

/**
 * Positions one non-main hypha given its already-positioned parent. Pure
 * and side-effect free (aside from consuming from `prng`, whose own state
 * threading is what makes the whole model deterministic for a fixed seed).
 */
function layoutChildHypha(
  draft: HyphaDraft,
  parent: PositionedHyphaResult,
  laneAssignment: LaneAssignment,
  bounds: TimeBounds,
  activity: ActivityCdf,
  prng: Prng,
): PositionedHyphaResult {
  const attach = pointOnHyphaAtTime(parent.points, draft.splitTime)
  const perp = normalizeVec3(vec3(-attach.tangent.z, 0, attach.tangent.x))
  // One fixed rotation per hypha (not per point): gives each loop its own
  // organic "lean" angle so concurrent same-side loops fan out instead of
  // reading as a rigid parallel comb (round-2/3 visual iteration finding).
  const bowAngleJitter = randJitter(prng, BOW_ANGLE_JITTER)

  const parentFrac = timeToFrac(draft.splitTime, bounds)
  const isOnMain = parent.hypha.kind === 'main'
  const depth = computeLoopDepth(draft, laneAssignment, attach.position, parentFrac, isOnMain, activity)

  const baseRadius = radiusForCommitCount(draft.commitCount)
  const durationNorm = logScale(Math.max(0, draft.endTime - draft.splitTime), 0, 1000 * 60 * 60 * 24 * 120)

  let endAnchorPosition: Vec3
  let endAnchorRadius: number
  let envelope: (t: number) => number

  if (draft.status === 'fused') {
    const rejoin = pointOnHyphaAtTime(parent.points, draft.endTime)
    endAnchorPosition = rejoin.position
    endAnchorRadius = attach.radius
    envelope = symmetricEnvelope
  } else {
    // The lateral (perpendicular) displacement is carried entirely by the
    // `bow` term below (envelope 0 at the split -> 1 at the free tip), the
    // same mechanism a fused loop uses -- NOT baked into `endAnchorPosition`
    // too, which would double-count it at the tip (env(1) === 1) and blow
    // past `depth`'s own cap. `endAnchorPosition` only carries a short
    // forward (tangential) reach, itself capped relative to `depth` so a
    // dead end/open tip never reads as a spoke poking into the next turn.
    const lengthRange = draft.status === 'dead_end' ? [DEAD_END_LENGTH_MIN, DEAD_END_LENGTH_MAX] : [OPEN_LENGTH_MIN, OPEN_LENGTH_MAX]
    const rawLength = lerp(lengthRange[0]!, lengthRange[1]!, durationNorm)
    const forwardReach = Math.min(rawLength * FORWARD_REACH_LENGTH_FRACTION, depth * FORWARD_REACH_DEPTH_FRACTION)
    const away = addVec3(attach.position, scaleVec3(attach.tangent, forwardReach))
    endAnchorPosition = draft.status === 'dead_end' ? subVec3(away, vec3(0, DEAD_END_DROOP * rawLength, 0)) : addVec3(away, vec3(0, OPEN_LIFT * rawLength, 0))
    endAnchorRadius = draft.status === 'dead_end' ? SIDE_MIN_RADIUS * 0.4 : baseRadius * 0.8
    envelope = openEndEnvelope
  }

  const controlPoints: SplineControlPoint[] = []
  const totalPoints = SIDE_INTERIOR_CONTROL_POINTS + 2
  for (let i = 0; i < totalPoints; i++) {
    const t = i / (totalPoints - 1)
    const env = envelope(t)
    const time = lerp(draft.splitTime, draft.endTime, t)

    // A fused (merged) loop's baseline follows the PARENT's own curve
    // between the split and rejoin times (not a straight chord between
    // just those two points) -- essential for a parent with a long
    // lifespan (e.g. a maintenance branch spanning years): a straight
    // chord would cut a stark "spoke" across a wide arc of the disc
    // instead of running parallel-ish alongside the parent, as intended.
    // A dead-end/open hypha has no such follow-along segment (it departs
    // the parent for good), so it keeps a straight run from the attach
    // point outward.
    const basis = draft.status === 'fused' ? pointOnHyphaAtTime(parent.points, time) : null
    const baseLinear = {
      x: attach.position.x + (endAnchorPosition.x - attach.position.x) * t,
      y: attach.position.y + (endAnchorPosition.y - attach.position.y) * t,
      z: attach.position.z + (endAnchorPosition.z - attach.position.z) * t,
    }
    const basePosition = basis ? basis.position : baseLinear
    const rawLocalPerp = basis ? normalizeVec3(vec3(-basis.tangent.z, 0, basis.tangent.x)) : perp
    const localPerp = rotateAroundY(rawLocalPerp, bowAngleJitter)

    const bow = scaleVec3(localPerp, laneAssignment.side * depth * env)
    const jitterMag = Math.min(depth * SIDE_JITTER_FRACTION, SIDE_JITTER_MAX) * env
    const jitter = vec3(randJitter(prng, jitterMag), randJitter(prng, jitterMag * 0.4), randJitter(prng, jitterMag))
    const position = addVec3(addVec3(basePosition, bow), jitter)
    const radius = lerp(baseRadius, endAnchorRadius, t)
    controlPoints.push({ position, radius, time })
  }
  // Endpoints are exact: no jitter/bow on the split point (tangent-continuous
  // with the parent by construction) or, for a fused loop, on the rejoin
  // point either.
  controlPoints[0] = { position: attach.position, radius: baseRadius, time: draft.splitTime }
  if (draft.status === 'fused') {
    controlPoints[controlPoints.length - 1] = { position: endAnchorPosition, radius: endAnchorRadius, time: draft.endTime }
  }

  const sampled = sampleCatmullRomCentripetal(controlPoints, SIDE_SAMPLES_PER_SEGMENT)
  const points: HyphaPoint[] = sampled.map((s) => ({ position: s.position, radius: Math.max(s.radius, 0.001), time: s.time }))

  const hypha: Hypha = {
    id: draft.id,
    kind: draft.kind,
    ref: draft.ref,
    time: draft.splitTime,
    parentHyphaId: draft.parentHyphaId,
    splitTime: draft.splitTime,
    endTime: draft.endTime,
    status: draft.status,
    points,
    lane: laneAssignment.lane,
    side: laneAssignment.side,
    commitCount: draft.commitCount,
    // The spiral layout always follows the real parent hypha's own curve at
    // the real split time (`pointOnHyphaAtTime(parent.points, ...)` above),
    // whether the parent is main or another PR -- an honest attach point
    // either way, unlike the colony layout's visual-only "sprout from the
    // colony" case. See `Hypha.attachment` in `types.ts`.
    attachment: 'parent-branch',
  }

  return { hypha, points }
}

export interface LayoutResult {
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  hairs: Hair[]
  nodesOmittedByHypha: Record<string, number>
}

function rotateAroundY(v: Vec3, angleRadians: number): Vec3 {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return vec3(v.x * cos - v.z * sin, v.y, v.x * sin + v.z * cos)
}

/**
 * One short lateral hair per rendered commit node (real mycelial texture,
 * never decorative filler -- see `Hair` in `types.ts`): branches off the
 * node's own position, alternating side by node order with a seeded angle
 * jitter on top, length scaled from the node's own (data-driven) radius
 * since no per-commit diff-size data is threaded through yet (constant
 * baseline + seeded jitter otherwise, per the task brief), a touch longer
 * for a merge-point commit (reinforcing its "fusion knot" without inventing
 * a separate element kind).
 */
function buildHairs(nodes: NetworkNode[], positionedById: Map<string, PositionedHyphaResult>, prng: Prng): Hair[] {
  const hairs: Hair[] = []
  nodes.forEach((node, index) => {
    const points = positionedById.get(node.hyphaId)?.points ?? []
    const basis = pointOnHyphaAtTime(points, node.time)
    const perp = normalizeVec3(vec3(-basis.tangent.z, 0, basis.tangent.x))
    const sideSign = index % 2 === 0 ? 1 : -1
    const angleJitter = randJitter(prng, HAIR_ANGLE_JITTER)
    const rotated = scaleVec3(rotateAroundY(perp, angleJitter), sideSign)
    const direction = normalizeVec3(addVec3(rotated, vec3(0, HAIR_Y_TILT, 0)))

    const lengthBase = clamp(node.radius * HAIR_LENGTH_FACTOR, HAIR_LENGTH_MIN, HAIR_LENGTH_MAX)
    const jittered = lengthBase + randJitter(prng, HAIR_LENGTH_JITTER)
    const length = Math.max(HAIR_MIN_LENGTH_FLOOR, jittered) * (node.isMergePoint ? HAIR_MERGE_LENGTH_BOOST : 1)

    hairs.push({
      id: `hair-${node.id}`,
      kind: 'hair',
      hyphaId: node.hyphaId,
      nodeId: node.id,
      time: node.time,
      ref: node.ref,
      position: node.position,
      direction,
      length,
      baseRadius: Math.max(node.radius * HAIR_BASE_RADIUS_FRACTION, HAIR_MIN_BASE_RADIUS),
    })
  })
  return hairs
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

/**
 * Positions the main hypha, then every other hypha (in topological order,
 * memoized so each parent is only ever computed once regardless of
 * traversal order), then commit/merge-point nodes and open/live-branch
 * tips.
 */
export function layoutNetwork(
  main: HyphaDraft,
  hyphae: HyphaDraft[],
  bounds: TimeBounds,
  seed: string,
  options: Partial<LayoutOptions> = {},
): LayoutResult {
  const resolved: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options }
  const prng = createPrng(`${seed}:network-layout`)
  const rotationOffset = randRange(prng, 0, Math.PI * 2)
  const activity = buildActivityCdf(main, hyphae, bounds)

  const mainBasis = buildMainControlPoints(bounds, rotationOffset, prng, activity)
  const mainSampled = sampleCatmullRomCentripetal(mainBasis, MAIN_SAMPLES_PER_SEGMENT)
  const mainPoints: HyphaPoint[] = mainSampled.map((s) => ({ position: s.position, radius: Math.max(s.radius, 0.001), time: s.time }))

  const mainHypha: Hypha = {
    id: main.id,
    kind: 'main',
    ref: main.ref,
    time: main.splitTime,
    parentHyphaId: null,
    splitTime: main.splitTime,
    endTime: main.endTime,
    status: 'open',
    points: mainPoints,
    lane: 0,
    side: 0,
    commitCount: main.commitCount,
    attachment: null,
  }

  const positionedById = new Map<string, PositionedHyphaResult>([[main.id, { hypha: mainHypha, points: mainPoints }]])
  const draftById = new Map<string, HyphaDraft>(hyphae.map((d) => [d.id, d]))

  const byParent = new Map<string, HyphaDraft[]>()
  for (const draft of hyphae) {
    const key = draft.parentHyphaId ?? main.id
    const list = byParent.get(key) ?? []
    list.push(draft)
    byParent.set(key, list)
  }
  const laneAssignments = assignLanes(byParent)

  function resolvePositioned(id: string): PositionedHyphaResult {
    const cached = positionedById.get(id)
    if (cached) return cached

    const draft = draftById.get(id)
    if (!draft) {
      // Should not happen (topology never leaves a dangling reference), but
      // fail safe rather than throwing during layout.
      return { hypha: mainHypha, points: mainPoints }
    }
    const parent = resolvePositioned(draft.parentHyphaId ?? main.id)
    const lane = laneAssignments.get(id) ?? { lane: 0, side: 1 as const }
    const positioned = layoutChildHypha(draft, parent, lane, bounds, activity, prng)
    positionedById.set(id, positioned)
    return positioned
  }

  for (const draft of hyphae) resolvePositioned(draft.id)

  const nodes: NetworkNode[] = []
  const tips: Tip[] = []
  const nodesOmittedByHypha: Record<string, number> = {}

  function buildNodesFor(id: string, draft: { commits: { time: number; ref: NetworkRef; isMergePoint: boolean }[] }): void {
    const positioned = positionedById.get(id)
    if (!positioned) return
    const { kept, omitted } = capEvenly(draft.commits, resolved.maxNodesPerHypha)
    if (omitted > 0) nodesOmittedByHypha[id] = omitted
    for (const commit of kept) {
      const at = pointOnHyphaAtTime(positioned.points, commit.time)
      nodes.push({
        id: `node-${id}-${commit.ref.type}-${commit.ref.id}`,
        kind: 'node',
        hyphaId: id,
        time: commit.time,
        ref: commit.ref,
        position: at.position,
        radius: Math.max(at.radius * (commit.isMergePoint ? 1.4 : 1), 0.006),
        isMergePoint: commit.isMergePoint,
      })
    }
  }

  buildNodesFor(main.id, main)
  for (const draft of hyphae) buildNodesFor(draft.id, draft)

  for (const draft of hyphae) {
    if (draft.status !== 'open') continue
    const positioned = positionedById.get(draft.id)
    if (!positioned || positioned.points.length === 0) continue
    const last = positioned.points[positioned.points.length - 1]!
    tips.push({
      id: `tip-${draft.id}`,
      kind: 'tip',
      hyphaId: draft.id,
      time: last.time,
      ref: draft.ref,
      position: last.position,
    })
  }

  const spore: Spore = {
    id: 'spore',
    kind: 'spore',
    time: bounds.firstEventTime,
    ref: mainHypha.ref,
    position: mainPoints[0]?.position ?? vec3(0, 0, 0),
  }

  const orderedHyphae: Hypha[] = [mainHypha, ...hyphae.map((d) => positionedById.get(d.id)!.hypha)]
  const hairs = buildHairs(nodes, positionedById, prng)

  return { spore, hyphae: orderedHyphae, nodes, tips, hairs, nodesOmittedByHypha }
}
