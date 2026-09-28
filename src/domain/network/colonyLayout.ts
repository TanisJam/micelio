import type { ReleaseInfo } from '../repo'
import { clamp, easeInOutCubic, lerp, logScale } from '../math'
import { createPrng, randJitter, randRange, type Prng } from '../tree/prng'
import type { TimeBounds } from '../tree/types'
import { polarToVec3, subVec3, vec3, type Vec3 } from '../tree/vector'
import {
  capEvenly,
  DEFAULT_LAYOUT_OPTIONS,
  discRadius,
  DISC_MAX_RADIUS,
  pointOnHyphaAtRadius,
  radiusForCommitCount,
  radiusForFrac,
  timeToFrac,
  type LayoutOptions,
} from './layout'
import { buildMushroomsOnRings } from './mushrooms'
import type { HyphaCommitDraft, HyphaDraft } from './topology'
import type { Fusion, GrowthRing, Hair, Hypha, HyphaPoint, Mushroom, NetworkNode, Spore, Tip } from './types'

/**
 * The RADIAL COLONY layout (M2d rewrite of M2c): grows the mycelium the way
 * space colonization/gap-filling growth actually looks, instead of M2c's
 * "author sector" mapping. The orchestrator's review of the M2c images found
 * they read as nested polygons/tangential arcs, not mycelium -- root-caused
 * to two design choices, both removed here:
 *
 * 1. Hypha LENGTH was `endTime - splitTime` (real duration): a PR open for
 *    years but touching one file drew a long spoke; a huge PR merged in a
 *    day drew a dot. Replaced with a WORK-driven length (commits +
 *    added/deleted lines, log-scaled) -- see `computeWorkLength`.
 * 2. ANGLE was the PR author's fixed sector, and a hypha swept from its
 *    sprout angle to that fixed target across its *entire* length --
 *    reading as a tangential arc/chord, especially for a far sector.
 *    Replaced with GAP-FILLING: a hypha's target angle is the center of the
 *    largest angular gap among whatever already occupies its own starting
 *    radius (`chooseTargetAngle`), with only a short Y-fork turn near the
 *    base, then near-radial growth (`growHyphaPoints`) -- author is no
 *    longer part of layout at all (kept only as optional color metadata,
 *    see `sectors.ts`).
 *
 * Shares `topology.ts` (the DAG) with the spiral layout; only the geometry
 * strategy differs. See the M2d section of `odd/tasks/huerto-mvp.md` for the
 * full mapping rationale and the per-round visual iteration notes.
 */

// --- Work -> length (item 2 of the M2d brief) -----------------------------
/** Shortest a hypha is ever drawn (a single-commit, no-diff-stats PR) -- still a visible, deliberate filament, never a dot. */
export const COLONY_LENGTH_MIN = 0.25
/** Longest a hypha is ever drawn, regardless of how much real work backs it. */
export const COLONY_LENGTH_MAX = 1.4
/** A closed-unmerged PR's hypha is stunted -- same work-based length, scaled down (a dead branch that never fully grew). */
export const COLONY_CLOSED_LENGTH_MULTIPLIER = 0.6
const WORK_COMMIT_WEIGHT = 1
/** Lines matter, but far less per-unit than a commit (a single 2000-line vendor-file commit shouldn't dominate); tuned during visual iteration. */
const WORK_LINE_WEIGHT = 0.015
const WORK_LENGTH_SCALE = 0.34

/**
 * `commits*a + lines*b`, log-scaled and clamped into `[COLONY_LENGTH_MIN,
 * COLONY_LENGTH_MAX]` -- see the module doc's point 1. `workLines` is `null`
 * for a closed/open PR (no diff stats fetched, see M1); treated as 0 real
 * lines, never fabricated. Exported for tests: this is `L_h` from the task
 * brief, which is NOT always the same as a hypha's own rendered radial
 * extent (`endRadius - startRadius`) -- see the "r_end = r0 + L_h" comment
 * at this function's call site for why a spore-started hypha's rendered
 * length can legitimately exceed `L_h`.
 */
export function computeWorkLength(commitCount: number, workLines: number | null): number {
  const lines = workLines ?? 0
  const work = Math.max(0, commitCount) * WORK_COMMIT_WEIGHT + Math.max(0, lines) * WORK_LINE_WEIGHT
  const raw = COLONY_LENGTH_MIN + WORK_LENGTH_SCALE * Math.log1p(work)
  return clamp(raw, COLONY_LENGTH_MIN, COLONY_LENGTH_MAX)
}

// --- Gap-filling angle (item 2 of the M2d brief) --------------------------
/** Fixed reference rays from the spore, always considered alongside whatever already spans a given radius -- keeps the very first handful of hyphae (and any radius where only one neighbor exists) from collapsing the "largest gap" search into one enormous, poorly-centered arc. See `chooseTargetAngle`. */
const SPORE_RAY_COUNT = 10
/** "target angle = gap center + small seeded jitter (<= 10% of gap)". */
const GAP_JITTER_FRACTION = 0.1
/** A direct-commit spur is minor texture, not a structural hypha -- a looser jitter reads as more organic without needing to be precisely gap-centered. */
const SPUR_GAP_JITTER_FRACTION = 0.22

// --- Growth-path shaping (item 2e of the M2d brief) -----------------------
const FORK_FRACTION_MIN = 0.15
const FORK_FRACTION_MAX = 0.25
/** Floor for the radius used in every radius-dependent angle-cap conversion below, so a hypha starting extremely close to the spore doesn't get a wild angle swing from dividing by a near-zero radius. */
const MIN_RADIUS_FOR_ANGLE_CAP = 0.12
/**
 * Bounds the fork's total achievable turn (from the real start position's
 * own angle to the gap-filling target) by how much LATERAL (sideways)
 * distance that turn would sweep through at this hypha's own radius --
 * NOT by a fixed angle. An angle that's perfectly reasonable right next to
 * the spore (tiny radius -> tiny lateral sweep even for a wide turn)
 * becomes a huge, unnatural sideways loop at a large disc radius (lateral
 * distance is radius*angle, so it grows with radius for a fixed angle).
 * Round 2 of visual iteration (orchestrator feedback): an angle-only cap
 * still produced wide sweeping turns/a "big sinusoidal zigzag" wherever the
 * gap-driven target happened to be far from a real attach point at a large
 * radius. The lateral budget itself scales with the hypha's OWN length, so
 * a short hypha gets a proportionately short, modest turn.
 */
const FORK_LATERAL_BUDGET_FRACTION = 0.5
/** Absolute ceiling on the turn regardless of how generous the lateral budget computes to -- keeps even a very short, very central hypha's fork from folding back on itself. */
const FORK_ABSOLUTE_MAX_RAD = (70 * Math.PI) / 180
/** How much of the curve after the fork ramps the organic drift in from 0, so the fork's own end (angle == target, no drift) and the post-fork wiggle meet without a kink. */
const FORK_DRIFT_RAMP = 0.15
/** Well under one full cycle across the whole post-fork span -- a gentle bow, not a visible zigzag (round 2 finding: a higher frequency read as a jagged sawtooth even at a small amplitude, since an SVG polyline draws straight segments between samples). */
const CURL_FREQ_MIN = 0.5
const CURL_FREQ_MAX = 0.9
const CURL_PHASE_MAX = Math.PI * 2
/**
 * Amplitude of the post-fork organic wiggle around the target angle (item
 * 2e's "angular drift <= 0.06 rad total", tightened further after round 2's
 * "barely perceptible" note -- well under both that target and the 0.1 rad
 * test ceiling).
 */
const POST_FORK_DRIFT_MAX_RAD = 0.02
/** "lateral amplitude <= 0.02*R" (item 2e) is the spec ceiling; kept at half that (0.01*R) per round 2's "barely perceptible" note. */
const LATERAL_MAX_WORLD = 0.01 * DISC_MAX_RADIUS
/** For a hypha longer than `COLONY_LENGTH_MAX` (a spore-started one whose real r0 is large -- see `growHyphaPoints`), the lateral wiggle budget instead scales with its OWN length by this fraction, so a long strand still visibly meanders rather than reading as a rigid straight spoke. */
const WIGGLE_LENGTH_FRACTION = 0.05
const Y_JITTER = 0.015
const SAMPLES_MIN = 12
const SAMPLES_MAX = 40
/**
 * "clamp open/long hyphae so the disc stays round" (round 2 orchestrator
 * feedback -- the un-clamped model measured `bounds.radius` up to 6.25
 * against a nominal `DISC_MAX_RADIUS` of 5). Applied to every hypha's own
 * `endRadius`, not just open/dead-end ones: a hard rim, 5% beyond the
 * nominal disc for a little organic overrun without an obviously-clipped
 * flat edge.
 */
const COLONY_RADIUS_CAP = DISC_MAX_RADIUS * 1.05

// --- Fusion (anastomosis) search -------------------------------------------
/** "connect with a short bridge to the nearest OTHER hypha point within a small radius (<= 0.25)" (item 4). */
const FUSION_SEARCH_RADIUS = 0.25
const RADIUS_BIN_WIDTH = 0.1
/** Bins to each side of the tip's own bin -- `RADIUS_BIN_WIDTH * (2 * spread + 1)` comfortably covers `FUSION_SEARCH_RADIUS`. */
const FUSION_SEARCH_BIN_SPREAD = 3

// --- Direct-commit spur tuning (item 3 of the M2d brief) ------------------
const SPUR_LENGTH_MIN = 0.05
const SPUR_LENGTH_MAX = 0.16
const SPUR_LENGTH_JITTER = 0.015
const SPUR_BASE_RADIUS_FRACTION = 0.35
const SPUR_MIN_BASE_RADIUS = 0.002

// --- Hair tuning (reuses the spiral's `Hair` element) ----------------------
const HAIR_LENGTH_FACTOR = 2.2
const HAIR_LENGTH_MIN = 0.018
const HAIR_LENGTH_MAX = 0.05
const HAIR_LENGTH_JITTER = 0.008
const HAIR_MIN_LENGTH_FLOOR = 0.006
const HAIR_BASE_RADIUS_FRACTION = 0.35
const HAIR_MIN_BASE_RADIUS = 0.0015
const HAIR_ANGLE_JITTER = 0.5
const HAIR_MERGE_LENGTH_BOOST = 1.6

// --- Ring tuning ------------------------------------------------------------
const MAX_YEAR_RINGS = 40

/**
 * Re-expresses `to` as `from` plus the shortest signed angular distance
 * between them (in `(-pi, pi]`) -- critical before linearly interpolating
 * two angles that can represent the same direction while differing
 * numerically by nearly `2*pi` (an M2c bug, see the M2d task brief's root
 * cause #2 -- fixed there by this same function, kept here unchanged).
 */
function shortestAngleTo(from: number, to: number): number {
  const twoPi = Math.PI * 2
  const wrapped = (((to - from + Math.PI) % twoPi) + twoPi) % twoPi
  return from + wrapped - Math.PI
}

/** Circular distance (>= 0, <= pi) between two angles. */
function angularDistance(a: number, b: number): number {
  return Math.abs(shortestAngleTo(a, b) - a)
}

/**
 * "Find the LARGEST angular gap; target angle = gap center + small seeded
 * jitter (<= `jitterFraction` of the gap)." With zero reference angles,
 * picks an arbitrary seeded angle (nothing to fill a gap relative to). With
 * exactly one, the only sensible "gap center" is directly opposite it.
 */
function pickAngleInLargestGap(angles: number[], prng: Prng, jitterFraction: number): number {
  const twoPi = Math.PI * 2
  if (angles.length === 0) return randRange(prng, 0, twoPi)

  const normalized = angles.map((a) => ((a % twoPi) + twoPi) % twoPi).sort((a, b) => a - b)
  if (normalized.length === 1) {
    const center = normalized[0]! + Math.PI
    const jitter = jitterFraction > 0 ? randJitter(prng, Math.PI * jitterFraction) : 0
    return center + jitter
  }

  let bestGap = -1
  let bestCenter = 0
  for (let i = 0; i < normalized.length; i++) {
    const a = normalized[i]!
    const b = i + 1 < normalized.length ? normalized[i + 1]! : normalized[0]! + twoPi
    const gap = b - a
    if (gap > bestGap) {
      bestGap = gap
      bestCenter = a + gap / 2
    }
  }
  const jitter = jitterFraction > 0 ? randJitter(prng, bestGap * jitterFraction) : 0
  return bestCenter + jitter
}

interface SpanningEntry {
  hypha: Hypha
  angleAtR0: number
}

/** Every already-placed hypha whose disc-radius span (base -> tip) contains `r0`, with its own angle interpolated exactly at that radius -- item 2c/2d's "already-placed hypha that spans r0". */
function computeSpanning(placed: Hypha[], r0: number): SpanningEntry[] {
  const spanning: SpanningEntry[] = []
  for (const hypha of placed) {
    const startR = discRadius(hypha.points[0]!.position)
    const endR = discRadius(hypha.points[hypha.points.length - 1]!.position)
    if (r0 < startR - 1e-9 || r0 > endR + 1e-9) continue
    const at = pointOnHyphaAtRadius(hypha.points, r0)
    spanning.push({ hypha, angleAtR0: Math.atan2(at.position.z, at.position.x) })
  }
  return spanning
}

/**
 * Item 2c: if something already spans `r0`, target the largest gap among
 * those (plus the spore's fixed reference rays). Otherwise (nothing spans
 * `r0` yet -- typically early in construction, near the spore), maximize
 * distance to every already-placed hypha's own *start* -- "first hyphae
 * radiate around the spore evenly" -- which is the same largest-gap search
 * over a different candidate set, so it's the same helper either way.
 */
/**
 * A hypha's own directional identity near its base -- NOT literally
 * `points[0]`, which for a spore-started hypha (no real parent point to
 * leave from) is the origin `(0, 0, 0)` for every such hypha, an
 * indistinguishable degenerate angle (`atan2(0, 0) === 0`) that would
 * otherwise collapse the "existing hypha starts" fallback below into a
 * single repeated point. The second sample point always carries a real,
 * distinct direction (radial growth has already begun by then).
 */
function hyphaBaseDirectionAngle(hypha: Hypha): number {
  const point = hypha.points[1] ?? hypha.points[0]!
  return Math.atan2(point.position.z, point.position.x)
}

function chooseTargetAngle(spanning: SpanningEntry[], sporeRays: number[], placed: Hypha[], prng: Prng): number {
  if (spanning.length > 0) {
    const angles = [...spanning.map((s) => s.angleAtR0), ...sporeRays]
    return pickAngleInLargestGap(angles, prng, GAP_JITTER_FRACTION)
  }
  const starts = placed.map(hyphaBaseDirectionAngle)
  return pickAngleInLargestGap(starts, prng, 0)
}

/** Item 2d: "the hypha spanning r0 whose angle at r0 is angularly closest to theta_h" -- the literal parent-selection rule, by *position* angle. `null` when nothing spans r0. */
function closestSpanningByAngle(spanning: SpanningEntry[], targetAngle: number): SpanningEntry | null {
  let best: SpanningEntry | null = null
  let bestDist = Infinity
  for (const candidate of spanning) {
    const dist = angularDistance(candidate.angleAtR0, targetAngle)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best
}

/** See `FORK_LATERAL_BUDGET_FRACTION`'s doc comment -- the maximum turn (radians) a hypha of this radius and length may take from its real start angle toward its gap-filling target. */
function maxTurnRadians(radius: number, length: number): number {
  const lateralBudget = length * FORK_LATERAL_BUDGET_FRACTION
  const fromLateral = lateralBudget / Math.max(radius, MIN_RADIUS_FOR_ANGLE_CAP)
  return Math.min(FORK_ABSOLUTE_MAX_RAD, fromLateral)
}

function sampleCountForLength(length: number): number {
  const span = COLONY_LENGTH_MAX - COLONY_LENGTH_MIN * COLONY_CLOSED_LENGTH_MULTIPLIER
  const t = span > 0 ? clamp((length - COLONY_LENGTH_MIN * COLONY_CLOSED_LENGTH_MULTIPLIER) / span, 0, 1) : 1
  return Math.round(lerp(SAMPLES_MIN, SAMPLES_MAX, t))
}

interface GrowParams {
  startPosition: Vec3
  startRadius: number
  targetAngleRaw: number
  endRadius: number
  splitTime: number
  endTime: number
  commitCount: number
  status: HyphaDraft['status']
  prng: Prng
}

/**
 * Item 2e: starts exactly at the parent's real point (or the spore's
 * origin), turns from that point's own REAL angle to the target angle over
 * the first ~15-25% of the length (a Y-fork, its total turn bounded by
 * `maxTurnRadians` -- see that doc comment), then grows near-radially with
 * a small organic wiggle. Radius is always `lerp(startRadius, endRadius, t)`
 * -- by construction (via `polarToVec3`) the rendered disc-radius of every
 * sample exactly equals that value, so "radius non-decreasing along the
 * path" holds exactly, not approximately, regardless of angle.
 *
 * Deliberately does NOT use the parent curve's local TANGENT (direction of
 * travel) as the fork's starting direction, despite that being the more
 * "graceful" choice on paper -- round 2 of visual iteration found this
 * produced actual DISCONTINUITIES: `points[0]` is always forced to the
 * parent's real POSITION, but a tangent can point in a meaningfully
 * different direction than that position's own angle (e.g. if the attach
 * point sits inside the parent's own fork/drift), so growth computed via
 * `polarToVec3(tangent-based angle, ...)` for the very next sample could
 * jump to a completely different angle at nearly the same radius -- a
 * multi-unit single-segment "chord" straight across the disc (see the round
 * 2 progress notes for the measured example). Using the position's own
 * angle as the starting direction is trivially exact and only that: the
 * next sample's angle differs from `points[0]`'s by an infinitesimal amount
 * as `t -> 0`, so continuity holds by construction.
 */
function growHyphaPoints(params: GrowParams): HyphaPoint[] {
  const { startPosition, startRadius, targetAngleRaw, endRadius, splitTime, endTime, commitCount, status, prng } = params

  const thicknessStart = radiusForCommitCount(commitCount)
  const thicknessEnd = status === 'fused' ? thicknessStart * 0.85 : status === 'dead_end' ? thicknessStart * 0.35 : thicknessStart * 0.7

  // At the spore itself (radius ~0) there is no meaningful "real angle" to
  // continue from (every direction is equally the start) and no lateral
  // distance for any turn to sweep through, so growth simply heads straight
  // for the target with no fork at all.
  const hasRealStartAngle = startRadius > 1e-6
  const startAngle = hasRealStartAngle ? Math.atan2(startPosition.z, startPosition.x) : targetAngleRaw
  const unwrappedTarget = shortestAngleTo(startAngle, targetAngleRaw)
  const maxTurn = hasRealStartAngle ? maxTurnRadians(startRadius, Math.max(0, endRadius - startRadius)) : Math.PI
  const targetAngle = startAngle + clamp(unwrappedTarget - startAngle, -maxTurn, maxTurn)

  const forkFraction = hasRealStartAngle ? randRange(prng, FORK_FRACTION_MIN, FORK_FRACTION_MAX) : 0
  const rampEnd = Math.min(1, forkFraction + FORK_DRIFT_RAMP)
  // A spore-started hypha can be meaningfully longer than a normal
  // (`COLONY_LENGTH_MAX`-bounded) one -- see the "r_end = r0 + L_h" comment
  // at the call site. `LATERAL_MAX_WORLD`/`POST_FORK_DRIFT_MAX_RAD` alone
  // (tuned for a <=1.4-unit hypha) reads as "barely perceptible" there but
  // renders as an almost perfectly straight spoke over a much longer run
  // (round 4 finding) -- scale both the lateral wiggle budget and the curl
  // frequency up with the hypha's own total length so a long strand still
  // visibly meanders, proportionate to how far it actually travels.
  const totalLength = Math.max(0, endRadius - startRadius)
  const lengthScale = Math.max(1, totalLength / COLONY_LENGTH_MAX)
  const lateralBudget = Math.max(LATERAL_MAX_WORLD, totalLength * WIGGLE_LENGTH_FRACTION)
  const curlFreq = randRange(prng, CURL_FREQ_MIN, CURL_FREQ_MAX) * lengthScale
  const curlPhase = randRange(prng, 0, CURL_PHASE_MAX)

  const sampleCount = clamp(sampleCountForLength(totalLength), SAMPLES_MIN, SAMPLES_MAX)
  const points: HyphaPoint[] = []

  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1)
    const radius = lerp(startRadius, endRadius, t)
    const time = lerp(splitTime, endTime, t)

    let angle: number
    if (t <= forkFraction) {
      const localT = forkFraction > 0 ? t / forkFraction : 1
      angle = lerp(startAngle, targetAngle, easeInOutCubic(localT))
    } else {
      const envelopeT = rampEnd > forkFraction ? clamp((t - forkFraction) / (rampEnd - forkFraction), 0, 1) : 1
      const envelope = easeInOutCubic(envelopeT)
      const driftCap = Math.min(POST_FORK_DRIFT_MAX_RAD * lengthScale, lateralBudget / Math.max(radius, MIN_RADIUS_FOR_ANGLE_CAP))
      const drift = driftCap * envelope * Math.sin(curlFreq * t * Math.PI * 2 + curlPhase)
      angle = targetAngle + drift
    }

    const y = randJitter(prng, Y_JITTER) * Math.sin(Math.PI * t)
    const thickness = Math.max(lerp(thicknessStart, thicknessEnd, t), 0.001)
    points.push({ position: polarToVec3(angle, radius, y), radius: thickness, time })
  }

  // Endpoint exact: the fork starts precisely on the parent's own real point
  // (or the spore's origin), never an approximation -- `distance <= 1e-6` is
  // a hard test requirement (item "fork start lies on parent").
  points[0] = { position: startPosition, radius: thicknessStart, time: splitTime }
  return points
}

function buildColonyRings(releases: ReleaseInfo[], bounds: TimeBounds, radiusForTime: (time: number) => number): GrowthRing[] {
  const rings: GrowthRing[] = []
  for (const release of releases) {
    const time = Date.parse(release.date)
    if (!Number.isFinite(time)) continue
    rings.push({
      id: `ring-release-${release.tag}`,
      kind: 'ring',
      ringKind: 'release',
      time,
      radius: radiusForTime(time),
      ref: { type: 'release', id: release.tag },
    })
  }

  // Faint calendar-year rings -- real elapsed time (Jan 1 boundaries within
  // the repo's own real lifetime), not fabricated data; non-interactive
  // (`ref: null`, excluded from `LookupableNetworkElement`), purely a
  // background growth-rate reference.
  if (bounds.lastEventTime > bounds.firstEventTime) {
    const startYear = new Date(bounds.firstEventTime).getUTCFullYear()
    const endYear = new Date(bounds.lastEventTime).getUTCFullYear()
    let count = 0
    for (let year = startYear + 1; year <= endYear && count < MAX_YEAR_RINGS; year++) {
      const time = Date.UTC(year, 0, 1)
      if (time <= bounds.firstEventTime || time >= bounds.lastEventTime) continue
      rings.push({ id: `ring-year-${year}`, kind: 'ring', ringKind: 'year', time, radius: radiusForTime(time), ref: null })
      count += 1
    }
  }

  rings.sort((a, b) => a.radius - b.radius)
  return rings
}

interface RadiusBinEntry {
  position: Vec3
  hyphaId: string
}

/** A coarse spatial grid keyed by disc-radius bin -- O(1)-ish nearest-neighbor fusion queries regardless of total hypha count (see the perf test). */
class RadiusGrid {
  private readonly bins = new Map<number, RadiusBinEntry[]>()

  private binIndex(radius: number): number {
    return Math.floor(radius / RADIUS_BIN_WIDTH)
  }

  insert(entry: RadiusBinEntry, radius: number): void {
    const index = this.binIndex(radius)
    const list = this.bins.get(index)
    if (list) list.push(entry)
    else this.bins.set(index, [entry])
  }

  nearby(radius: number, spread: number): RadiusBinEntry[] {
    const center = this.binIndex(radius)
    const out: RadiusBinEntry[] = []
    for (let i = center - spread; i <= center + spread; i++) {
      const list = this.bins.get(i)
      if (list) out.push(...list)
    }
    return out
  }
}

function nearestRingOrSpore(rings: GrowthRing[], radius: number, angle: number): { position: Vec3; kind: 'ring' | 'spore' } {
  let bestRadius = 0
  let bestKind: 'ring' | 'spore' = 'spore'
  let bestDiff = Math.abs(radius - 0)
  for (const ring of rings) {
    const diff = Math.abs(ring.radius - radius)
    if (diff < bestDiff) {
      bestDiff = diff
      bestRadius = ring.radius
      bestKind = 'ring'
    }
  }
  return { position: polarToVec3(angle, bestRadius, 0), kind: bestKind }
}

/**
 * Item 4: "connect with a short bridge to the nearest OTHER hypha point
 * within a small radius (<= 0.25); if none, just a small knot." When nothing
 * (hypha or ring/spore) is close enough, the bridge collapses to the tip
 * itself (zero length -- "just a knot"), still tagged with whichever
 * candidate was nominally closest for typing purposes.
 */
function findFusionAnchor(grid: RadiusGrid, selfHyphaId: string, tip: Vec3, radius: number, rings: GrowthRing[]): { position: Vec3; kind: 'hypha' | 'ring' | 'spore' } {
  let bestHypha: RadiusBinEntry | null = null
  let bestHyphaDist = Infinity
  for (const candidate of grid.nearby(radius, FUSION_SEARCH_BIN_SPREAD)) {
    if (candidate.hyphaId === selfHyphaId) continue
    const dist = Math.hypot(candidate.position.x - tip.x, candidate.position.z - tip.z)
    if (dist < bestHyphaDist) {
      bestHyphaDist = dist
      bestHypha = candidate
    }
  }

  const angle = Math.atan2(tip.z, tip.x)
  const ringFallback = nearestRingOrSpore(rings, radius, angle)
  const ringDist = Math.hypot(ringFallback.position.x - tip.x, ringFallback.position.z - tip.z)

  const useHypha = bestHypha !== null && bestHyphaDist <= ringDist
  const bestDist = useHypha ? bestHyphaDist : ringDist
  if (bestDist > FUSION_SEARCH_RADIUS) {
    return { position: tip, kind: useHypha ? 'hypha' : ringFallback.kind }
  }
  return useHypha ? { position: bestHypha!.position, kind: 'hypha' } : { position: ringFallback.position, kind: ringFallback.kind }
}

function pointOnHyphaAtFraction(points: HyphaPoint[], t: number): { position: Vec3; tangentAngle: number } {
  if (points.length === 1) return { position: points[0]!.position, tangentAngle: 0 }
  const clampedT = clamp(t, 0, 1)
  const scaled = clampedT * (points.length - 1)
  const indexLow = Math.min(points.length - 2, Math.floor(scaled))
  const localT = scaled - indexLow
  const a = points[indexLow]!
  const b = points[indexLow + 1]!
  const position = {
    x: a.position.x + (b.position.x - a.position.x) * localT,
    y: a.position.y + (b.position.y - a.position.y) * localT,
    z: a.position.z + (b.position.z - a.position.z) * localT,
  }
  const tangent = subVec3(b.position, a.position)
  return { position, tangentAngle: Math.atan2(tangent.z, tangent.x) }
}

function rotateAroundY(v: Vec3, angleRadians: number): Vec3 {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return vec3(v.x * cos - v.z * sin, v.y, v.x * sin + v.z * cos)
}

/**
 * Item 3: "Commits = hairs along their hypha, placed by commit order evenly
 * along the path (not by time)". Uses `pointOnHyphaAtFraction` (index-based)
 * rather than `pointOnHyphaAtTime` -- deliberately ignores each commit's own
 * real timestamp for *positioning* (only its order matters), since the
 * hypha's own length is now work-driven, not time-driven, so a strict
 * time-interpolated placement would bunch commits unevenly again.
 */
function buildOrderedCommitElements(hypha: Hypha, commits: HyphaCommitDraft[], prng: Prng): { nodes: NetworkNode[]; hairs: Hair[] } {
  const nodes: NetworkNode[] = []
  const hairs: Hair[] = []
  const baseThickness = radiusForCommitCount(hypha.commitCount)

  commits.forEach((commit, index) => {
    const t = commits.length === 1 ? 0.5 : index / (commits.length - 1)
    const at = pointOnHyphaAtFraction(hypha.points, t)
    const nodeId = `node-${hypha.id}-${commit.ref.type}-${commit.ref.id}`
    const thickness = Math.max(baseThickness * (1 - t * 0.4), 0.004)
    nodes.push({ id: nodeId, kind: 'node', hyphaId: hypha.id, time: commit.time, ref: commit.ref, position: at.position, radius: thickness, isMergePoint: commit.isMergePoint })

    const perp = vec3(-Math.sin(at.tangentAngle), 0, Math.cos(at.tangentAngle))
    const sideSign = index % 2 === 0 ? 1 : -1
    const angleJitter = randJitter(prng, HAIR_ANGLE_JITTER)
    const direction = rotateAroundY(perp, angleJitter * sideSign)

    const lengthBase = clamp(thickness * HAIR_LENGTH_FACTOR, HAIR_LENGTH_MIN, HAIR_LENGTH_MAX)
    const jittered = lengthBase + randJitter(prng, HAIR_LENGTH_JITTER)
    const length = Math.max(HAIR_MIN_LENGTH_FLOOR, jittered) * (commit.isMergePoint ? HAIR_MERGE_LENGTH_BOOST : 1)

    hairs.push({
      id: `hair-${nodeId}`,
      kind: 'hair',
      hyphaId: hypha.id,
      nodeId,
      time: commit.time,
      ref: commit.ref,
      position: at.position,
      direction,
      length,
      baseRadius: Math.max(thickness * HAIR_BASE_RADIUS_FRACTION, HAIR_MIN_BASE_RADIUS),
    })
  })

  return { nodes, hairs }
}

/** A genuine direct commit on `main` -- excludes the merge-point pseudo-entries `topology.ts` also records there (those already get their own PR hypha's fusion knot). */
function isGenuineDirectCommit(c: HyphaCommitDraft): boolean {
  return c.ref.type === 'commit' && !c.isMergePoint
}

/**
 * Item 3: "Direct commits to the default branch = short hairs radiating from
 * the spore/nearest hypha at r(t)." Reuses the same gap-filling angle search
 * as a full hypha (against the FINAL placed-hyphae set, since spurs are pure
 * decoration and never influence other hyphae's own placement).
 */
function buildDirectCommitSpurs(main: HyphaDraft, placedHyphae: Hypha[], sporeRays: number[], radiusForTime: (time: number) => number, seed: string): { nodes: NetworkNode[]; hairs: Hair[] } {
  const directCommits = main.commits.filter(isGenuineDirectCommit)
  if (directCommits.length === 0) return { nodes: [], hairs: [] }

  const prng = createPrng(`${seed}:network-colony-spurs`)
  const nodes: NetworkNode[] = []
  const hairs: Hair[] = []

  for (const commit of directCommits) {
    const radius = radiusForTime(commit.time)
    const spanning = computeSpanning(placedHyphae, radius)
    const angles = [...spanning.map((s) => s.angleAtR0), ...sporeRays]
    const angle = pickAngleInLargestGap(angles, prng, SPUR_GAP_JITTER_FRACTION)
    const position = polarToVec3(angle, radius, 0)
    const nodeId = `node-${main.id}-commit-${commit.ref.id}`
    nodes.push({ id: nodeId, kind: 'node', hyphaId: main.id, time: commit.time, ref: commit.ref, position, radius: 0.006, isMergePoint: false })

    const direction = vec3(Math.cos(angle), 0, Math.sin(angle))
    const length = clamp(SPUR_LENGTH_MIN + randJitter(prng, SPUR_LENGTH_JITTER) + (SPUR_LENGTH_MAX - SPUR_LENGTH_MIN) * logScale(radius, 0, DISC_MAX_RADIUS), SPUR_LENGTH_MIN * 0.5, SPUR_LENGTH_MAX)
    hairs.push({
      id: `hair-${nodeId}`,
      kind: 'hair',
      hyphaId: main.id,
      nodeId,
      time: commit.time,
      ref: commit.ref,
      position,
      direction,
      length,
      baseRadius: Math.max(0.006 * SPUR_BASE_RADIUS_FRACTION, SPUR_MIN_BASE_RADIUS),
    })
  }

  return { nodes, hairs }
}

export interface ColonyLayoutResult {
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  hairs: Hair[]
  rings: GrowthRing[]
  fusions: Fusion[]
  mushrooms: Mushroom[]
  nodesOmittedByHypha: Record<string, number>
}

/**
 * Builds the colony layout from the shared topology (`topology.ts`'s
 * `HyphaDraft`s), processing hyphae in split-time order (item 2) so every
 * later hypha's gap search and parent search see everything placed so far.
 * Deterministic for a fixed seed. See the module doc above for the mapping.
 */
export function layoutNetworkColony(
  main: HyphaDraft,
  hyphae: HyphaDraft[],
  bounds: TimeBounds,
  seed: string,
  releases: ReleaseInfo[],
  options: Partial<LayoutOptions> = {},
): ColonyLayoutResult {
  const resolved: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options }
  const prng = createPrng(`${seed}:network-colony-layout`)
  const radiusForTime = (time: number): number => radiusForFrac(timeToFrac(time, bounds))

  const spore: Spore = { id: 'spore', kind: 'spore', time: bounds.firstEventTime, ref: main.ref, position: vec3(0, 0, 0) }
  const rings = buildColonyRings(releases, bounds, radiusForTime)

  // Colony has no rendered main curve (the disc/rings/spore ARE the colony)
  // -- this degenerate 2-point entry exists only so `main` stays a
  // lookupable `Hypha` (branch detail, id `hypha-main`), like the spiral
  // layout, not to be drawn as a line.
  const mainHypha: Hypha = {
    id: main.id,
    kind: 'main',
    ref: main.ref,
    time: main.splitTime,
    parentHyphaId: null,
    splitTime: main.splitTime,
    endTime: main.endTime,
    status: 'open',
    points: [
      { position: spore.position, radius: 0.01, time: bounds.firstEventTime },
      { position: spore.position, radius: 0.01, time: bounds.lastEventTime },
    ],
    lane: 0,
    side: 0,
    commitCount: main.commitCount,
    attachment: null,
  }

  const positionedById = new Map<string, Hypha>([[main.id, mainHypha]])
  const placedHyphae: Hypha[] = []
  const fusionGrid = new RadiusGrid()

  const sporeRayOffset = randRange(prng, 0, (Math.PI * 2) / SPORE_RAY_COUNT)
  const sporeRays = Array.from({ length: SPORE_RAY_COUNT }, (_, i) => sporeRayOffset + (i * Math.PI * 2) / SPORE_RAY_COUNT)

  const orderedDrafts = [...hyphae].sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))

  const nodes: NetworkNode[] = []
  const tips: Tip[] = []
  const fusions: Fusion[] = []
  const hairs: Hair[] = []
  const nodesOmittedByHypha: Record<string, number> = {}
  const hairPrng = createPrng(`${seed}:network-colony-hairs`)

  for (const draft of orderedDrafts) {
    const r0 = radiusForTime(draft.splitTime)
    const spanning = computeSpanning(placedHyphae, r0)
    const targetAngleRaw = chooseTargetAngle(spanning, sporeRays, placedHyphae, prng)

    const workLength = computeWorkLength(draft.commitCount, draft.workLines)
    const length = draft.status === 'dead_end' ? workLength * COLONY_CLOSED_LENGTH_MULTIPLIER : workLength

    // Item 2d: real branch-from-branch topology wins outright; otherwise
    // attach to whichever already-spanning hypha's own angle at r0 is
    // closest to the target -- BUT ONLY if that neighbor is close enough for
    // a natural fork (`maxTurnRadians`); otherwise (nothing spans r0 yet, OR
    // the closest one is still too far) sprout fresh from the spore. Round 3
    // finding: without this "too far -> spore" fallback, clamping the turn
    // toward whichever neighbor happened to be closest permanently glued
    // every new hypha to the SAME single already-populated arc (the closest
    // spanning neighbor is unavoidably IN that arc once any real structure
    // exists at all, so a plain clamp can never let growth reach a distant
    // real gap) -- the disc never filled past one crescent. The spore
    // fallback lets growth actually break away and seed real coverage
    // elsewhere (its reach now properly uses `r0`, not a fixed short stub --
    // see the `nominalEndRadius` comment below). The START POSITION is
    // always this real point (or the spore's origin); `growHyphaPoints`
    // derives its own starting direction from that position (never a
    // separate tangent -- see its doc comment for why).
    const isBranchFromBranch = draft.parentHyphaId !== null && draft.parentHyphaId !== main.id
    let startPosition: Vec3
    let attachment: 'colony' | 'parent-branch'
    let startedAtSpore = false

    if (isBranchFromBranch) {
      const parentHypha = positionedById.get(draft.parentHyphaId!) ?? mainHypha
      startPosition = pointOnHyphaAtRadius(parentHypha.points, r0).position
      attachment = 'parent-branch'
    } else {
      const closest = closestSpanningByAngle(spanning, targetAngleRaw)
      const naturalFit = closest !== null && angularDistance(closest.angleAtR0, targetAngleRaw) <= maxTurnRadians(r0, length)
      if (naturalFit) {
        startPosition = pointOnHyphaAtRadius(closest!.hypha.points, r0).position
      } else {
        startPosition = spore.position
        startedAtSpore = true
      }
      attachment = 'colony'
    }

    const startRadius = discRadius(startPosition)
    // Item 2e: "grow ... outward to r_end = r0 + L_h" -- r0 (real, time-based)
    // is the reference, not the literal rendered start radius. For a real
    // attach point this is nearly the same thing (`startRadius` was found
    // AT r0). But a hypha that starts at the SPORE (nothing spans r0 yet --
    // typically seeding a genuinely new angular region) has a `startRadius`
    // of 0 regardless of how large r0 itself is; using `startRadius + length`
    // there (round 2's first attempt) capped every such hypha's reach at
    // `COLONY_LENGTH_MAX` (~1.4) regardless of r0, so it could never extend
    // far enough to seed real coverage at its own actual radius -- once a
    // region's growth fell back to the spore once, every later hypha in
    // that same region kept re-falling back to a short center-hugging stub
    // (nothing ever spanned that radius there), collapsing the whole colony
    // into whichever single arc already had real structure (the crescent
    // shape from round 2's own images). Using `r0 + length` here instead
    // lets a spore-started hypha actually reach out to roughly its own real
    // radius, so it can anchor further real growth in that region.
    const nominalEndRadius = startedAtSpore ? r0 + length : startRadius + length
    // `COLONY_RADIUS_CAP` (round 2 orchestrator feedback: keep the disc
    // round) is the only clamp -- `Math.max(startRadius, ...)` keeps it
    // monotonic even for a hypha whose own `startRadius` is already past
    // the cap (a rare compounding-chain edge case).
    const endRadius = Math.max(startRadius, Math.min(nominalEndRadius, COLONY_RADIUS_CAP))

    const points = growHyphaPoints({
      startPosition,
      startRadius,
      targetAngleRaw,
      endRadius,
      splitTime: draft.splitTime,
      endTime: draft.endTime,
      commitCount: draft.commitCount,
      status: draft.status,
      prng,
    })

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
      lane: 0,
      side: 0,
      commitCount: draft.commitCount,
      attachment,
    }
    positionedById.set(draft.id, hypha)
    placedHyphae.push(hypha)
    for (const point of points) fusionGrid.insert({ position: point.position, hyphaId: draft.id }, discRadius(point.position))

    const { kept, omitted } = capEvenly(draft.commits, resolved.maxNodesPerHypha)
    if (omitted > 0) nodesOmittedByHypha[draft.id] = omitted
    const ordered = buildOrderedCommitElements(hypha, kept, hairPrng)
    nodes.push(...ordered.nodes)
    hairs.push(...ordered.hairs)

    if (draft.status === 'fused') {
      const tipPoint = points[points.length - 1]!
      const tipRadius = discRadius(tipPoint.position)
      const bridge = findFusionAnchor(fusionGrid, draft.id, tipPoint.position, tipRadius, rings)
      fusions.push({
        id: `fusion-${draft.id}`,
        kind: 'fusion',
        hyphaId: draft.id,
        time: draft.endTime,
        ref: draft.ref,
        position: tipPoint.position,
        bridgeTo: bridge.position,
        bridgeToKind: bridge.kind,
      })
    } else if (draft.status === 'open') {
      const tipPoint = points[points.length - 1]!
      tips.push({ id: `tip-${draft.id}`, kind: 'tip', hyphaId: draft.id, time: tipPoint.time, ref: draft.ref, position: tipPoint.position })
    }
  }

  const spurs = buildDirectCommitSpurs(main, placedHyphae, sporeRays, radiusForTime, seed)
  nodes.push(...spurs.nodes)
  hairs.push(...spurs.hairs)

  const mushrooms = buildMushroomsOnRings(releases, radiusForTime, placedHyphae, seed)

  return {
    spore,
    hyphae: [mainHypha, ...placedHyphae],
    nodes,
    tips,
    hairs,
    rings,
    fusions,
    mushrooms,
    nodesOmittedByHypha,
  }
}
