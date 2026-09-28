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
import type { Hypha, HyphaPoint, NetworkNode, NetworkRef, Spore, Tip } from './types'

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
const DISC_MAX_RADIUS = 5
/** < 1: early history gets proportionally more radius per unit time, so it isn't crushed near the spore. */
const RADIUS_EASE_EXPONENT = 0.58
const SPIRAL_TURNS = 2.4
const MAIN_Y = 0
const MAIN_Y_JITTER = 0.05
const MAIN_CONTROL_POINTS = 48
const MAIN_SAMPLES_PER_SEGMENT = 5
const MAIN_THICKNESS_MIN = 0.03
const MAIN_THICKNESS_MAX = 0.11
const MAIN_XZ_JITTER = 0.045

// --- Side-hypha tuning -----------------------------------------------
const SIDE_INTERIOR_CONTROL_POINTS = 4
const SIDE_SAMPLES_PER_SEGMENT = 7
const BASE_LANE_DEPTH = 0.07
const LANE_SPACING = 0.045
const SPIRAL_PITCH_SAFETY = 0.42
const MIN_PITCH_FLOOR = DISC_MAX_RADIUS * 0.015
const NESTED_MAX_LANE_DEPTH = 0.35
const SIDE_MIN_RADIUS = 0.012
const SIDE_MAX_RADIUS = 0.045
// A fraction of each loop's own `depth`, not an absolute magnitude -- a
// short/tight loop gets proportionally gentle wiggle instead of jitter big
// enough to swamp its own bow and read as a noisy scribble.
const SIDE_JITTER_FRACTION = 0.22
const SIDE_JITTER_MAX = 0.02
const DEAD_END_LENGTH_MIN = 0.15
const DEAD_END_LENGTH_MAX = 0.4
const DEAD_END_DROOP = 0.22
const OPEN_LENGTH_MIN = 0.18
const OPEN_LENGTH_MAX = 0.55
const OPEN_LIFT = 0.06

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

/** Exported for tests (e.g. checking loops never cross the next spiral turn) and potential UI reuse. */
export function radiusForFrac(frac: number): number {
  return DISC_MAX_RADIUS * Math.pow(clamp(frac, 0, 1), RADIUS_EASE_EXPONENT)
}

/** Radius gained over one full spiral turn (2*pi) starting at `frac` -- used to cap lane bow so loops never cross the next winding. */
export function localSpiralPitch(frac: number): number {
  const nextFrac = Math.min(1, frac + 1 / SPIRAL_TURNS)
  const pitch = radiusForFrac(nextFrac) - radiusForFrac(frac)
  return Math.max(pitch, MIN_PITCH_FLOOR)
}

interface MainPointBasis {
  position: Vec3
  radius: number
  time: number
}

function buildMainControlPoints(bounds: TimeBounds, rotationOffset: number, prng: Prng): MainPointBasis[] {
  const points: MainPointBasis[] = []
  for (let i = 0; i <= MAIN_CONTROL_POINTS; i++) {
    const t = i / MAIN_CONTROL_POINTS
    const time = lerp(bounds.firstEventTime, bounds.lastEventTime, t)
    const radius = radiusForFrac(t)
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

function radiusForCommitCount(commitCount: number): number {
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
 * Positions one non-main hypha given its already-positioned parent. Pure
 * and side-effect free (aside from consuming from `prng`, whose own state
 * threading is what makes the whole model deterministic for a fixed seed).
 */
function layoutChildHypha(
  draft: HyphaDraft,
  parent: PositionedHyphaResult,
  laneAssignment: LaneAssignment,
  bounds: TimeBounds,
  prng: Prng,
): PositionedHyphaResult {
  const attach = pointOnHyphaAtTime(parent.points, draft.splitTime)
  const perp = normalizeVec3(vec3(-attach.tangent.z, 0, attach.tangent.x))

  const parentFrac = timeToFrac(draft.splitTime, bounds)
  const isOnMain = parent.hypha.kind === 'main'
  const desiredDepth = BASE_LANE_DEPTH + laneAssignment.lane * LANE_SPACING
  let depthCap = isOnMain ? localSpiralPitch(parentFrac) * SPIRAL_PITCH_SAFETY : NESTED_MAX_LANE_DEPTH
  if (isOnMain) {
    // Near the disc's outer edge (newest history) there is no further
    // winding to avoid crossing, but a loop still must not visually poke
    // past the disc's own outer boundary -- cap depth by remaining radial
    // room too, not just the (otherwise near-zero) next-turn pitch.
    const attachRadius = Math.sqrt(attach.position.x * attach.position.x + attach.position.z * attach.position.z)
    const remainingRoom = Math.max(0.02, DISC_MAX_RADIUS - attachRadius)
    depthCap = Math.min(depthCap, remainingRoom)
  }
  const depth = Math.min(desiredDepth, depthCap)

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
    const lengthRange = draft.status === 'dead_end' ? [DEAD_END_LENGTH_MIN, DEAD_END_LENGTH_MAX] : [OPEN_LENGTH_MIN, OPEN_LENGTH_MAX]
    const length = lerp(lengthRange[0]!, lengthRange[1]!, durationNorm)
    const away = addVec3(
      addVec3(attach.position, scaleVec3(attach.tangent, length * 0.35)),
      scaleVec3(perp, laneAssignment.side * length * 0.9),
    )
    endAnchorPosition = draft.status === 'dead_end' ? subVec3(away, vec3(0, DEAD_END_DROOP * length, 0)) : addVec3(away, vec3(0, OPEN_LIFT * length, 0))
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
    const localPerp = basis ? normalizeVec3(vec3(-basis.tangent.z, 0, basis.tangent.x)) : perp

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
  }

  return { hypha, points }
}

export interface LayoutResult {
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  nodesOmittedByHypha: Record<string, number>
}

/** Picks an evenly-spaced representative subset (always including the first and last), honestly recording the rest as overflow. */
function capEvenly<T>(items: T[], max: number): { kept: T[]; omitted: number } {
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

  const mainBasis = buildMainControlPoints(bounds, rotationOffset, prng)
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
    const positioned = layoutChildHypha(draft, parent, lane, bounds, prng)
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

  return { spore, hyphae: orderedHyphae, nodes, tips, nodesOmittedByHypha }
}
