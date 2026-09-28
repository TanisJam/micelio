import type { CommitAuthor, ReleaseInfo } from '../repo'
import { clamp, easeInOutCubic, lerp, logScale } from '../math'
import { createPrng, randJitter, randRange, type Prng } from '../tree/prng'
import type { TimeBounds } from '../tree/types'
import { normalizeVec3, polarToVec3, subVec3, vec3, vec3Length, type Vec3 } from '../tree/vector'
import {
  capEvenly,
  DEFAULT_LAYOUT_OPTIONS,
  DISC_MAX_RADIUS,
  pointOnHyphaAtTime,
  radiusForCommitCount,
  radiusForFrac,
  timeToFrac,
  type LayoutOptions,
} from './layout'
import { buildMushroomsOnRings } from './mushrooms'
import { assignAngularSlots, assignSlotsWithinGroup, buildAuthorSectors, resolveSectorKey } from './sectors'
import type { HyphaCommitDraft, HyphaDraft } from './topology'
import type { Fusion, GrowthRing, Hair, Hypha, HyphaPoint, Mushroom, NetworkNode, NetworkRef, Spore, Tip } from './types'

/**
 * The RADIAL COLONY layout (M2c): an alternative to `layout.ts`'s spiral,
 * prototyped side-by-side behind `buildNetwork(snapshot, { layout: 'colony'
 * })`. The default branch is the colony itself (spore + concentric growth
 * rings, no rendered main curve); every PR hypha grows outward from near the
 * center to its own real end radius, angled into its author's sector, and
 * either fuses (a small knot + a short bridge to whatever real structure is
 * nearest at that radius), dries out, or keeps growing. See the M2c section
 * of `odd/tasks/huerto-mvp.md` for the full mapping rationale and visual
 * iteration notes. Shares `topology.ts` (the DAG) and `spline.ts`/prng/vector
 * helpers with the spiral layout; only the geometry strategy differs.
 */

// --- Growth-curve tuning -------------------------------------------------
const GROWTH_SAMPLES = 9
const CURL_FREQ_MIN = 1.1
const CURL_FREQ_MAX = 2.4
const CURL_PHASE_MAX = Math.PI * 2
/** Curl amplitude is a *fraction of the hypha's own sector width*, not an absolute angle -- keeps wiggle proportionate for both a wide "community" sector and a narrow top-contributor one. */
const CURL_AMPLITUDE_MIN_FRACTION = 0.05
const CURL_AMPLITUDE_MAX_FRACTION = 0.16
const Y_JITTER = 0.02

// --- Spatial index (nearest-neighbor sprouting/fusion search) -----------
/** World units per radius bin -- bounds how many candidate points a nearest-neighbor query has to scan, independent of total hyphae count (see the perf test). */
const RADIUS_BIN_WIDTH = 0.12
const SPROUT_SEARCH_BIN_SPREAD = 2
const FUSION_SEARCH_BIN_SPREAD = 2

// --- Direct-commit spur tuning --------------------------------------------
const SPUR_LENGTH_MIN = 0.05
const SPUR_LENGTH_MAX = 0.16
const SPUR_LENGTH_JITTER = 0.015
const SPUR_BASE_RADIUS_FRACTION = 0.35
const SPUR_MIN_BASE_RADIUS = 0.002
const SPUR_ANGLE_JITTER = 0.25

// --- PR-hypha hair tuning (reuses the spiral's `Hair` element, see `layout.ts`'s `buildHairs`) ---
const HAIR_LENGTH_FACTOR = 2.2
const HAIR_LENGTH_MIN = 0.018
const HAIR_LENGTH_MAX = 0.05
const HAIR_LENGTH_JITTER = 0.008
const HAIR_MIN_LENGTH_FLOOR = 0.006
const HAIR_BASE_RADIUS_FRACTION = 0.35
const HAIR_MIN_BASE_RADIUS = 0.0015
const HAIR_ANGLE_JITTER = 0.5
const HAIR_MERGE_LENGTH_BOOST = 1.6

// --- Ring tuning -----------------------------------------------------------
const MAX_YEAR_RINGS = 40

interface RadiusBinEntry {
  position: Vec3
  hyphaId: string
  sectorKey: string
}

/** A coarse spatial grid keyed by disc-radius bin -- O(1)-ish nearest-neighbor queries regardless of total hypha count. */
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

function angleOf(position: Vec3): number {
  return Math.atan2(position.z, position.x)
}

/**
 * Re-expresses `to` as `from` plus the shortest signed angular distance
 * between them (in `(-pi, pi]`) -- critical before linearly interpolating
 * two angles: `baseAngle` (an `atan2` result, always in `(-pi, pi]`) and
 * `targetAngle` (a sector angle that can be anywhere in `[0, 2*pi)`) can
 * represent the *same* direction while differing numerically by nearly
 * `2*pi` (e.g. `-0.46` and `5.8`); lerping the raw values would sweep the
 * curve almost all the way around the disc instead of the short way.
 */
function shortestAngleTo(from: number, to: number): number {
  const twoPi = Math.PI * 2
  const wrapped = (((to - from + Math.PI) % twoPi) + twoPi) % twoPi
  return from + wrapped - Math.PI
}

interface RingLikeCandidate {
  position: Vec3
  kind: 'ring' | 'spore'
}

/** The ring (or the spore, radius 0) whose radius is nearest to `radius`, projected onto `angle` -- the exact closest point on that circle to a point at `angle`/`radius`. */
function nearestRingOrSpore(rings: GrowthRing[], radius: number, angle: number): RingLikeCandidate {
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
 * The nearest already-positioned point in `sectorKey`, near disc-radius
 * `radius`, to the point at (`targetAngle`, `radius`) -- true branching: a
 * colony-attached PR sprouts from whatever real hypha happens to be nearby
 * in its own author's sector, or from the colony ring/spore when nothing is.
 */
function findSproutAnchor(grid: RadiusGrid, sectorKey: string, radius: number, targetAngle: number, rings: GrowthRing[]): { position: Vec3; kind: 'hypha' | 'ring' | 'spore' } {
  const targetPoint = polarToVec3(targetAngle, radius, 0)
  let best: RadiusBinEntry | null = null
  let bestDist = Infinity
  for (const candidate of grid.nearby(radius, SPROUT_SEARCH_BIN_SPREAD)) {
    if (candidate.sectorKey !== sectorKey) continue
    const dist = vec3Length(subVec3(candidate.position, targetPoint))
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  if (best) return { position: best.position, kind: 'hypha' }
  const fallback = nearestRingOrSpore(rings, radius, targetAngle)
  return { position: fallback.position, kind: fallback.kind }
}

/** The nearest neighboring hypha point (any sector, excluding `selfHyphaId`) or growth ring/spore at radius `radius`, for a merged hypha's fusion bridge. */
function findFusionAnchor(grid: RadiusGrid, selfHyphaId: string, tip: Vec3, radius: number, rings: GrowthRing[]): { position: Vec3; kind: 'hypha' | 'ring' | 'spore' } {
  let best: RadiusBinEntry | null = null
  let bestDist = Infinity
  for (const candidate of grid.nearby(radius, FUSION_SEARCH_BIN_SPREAD)) {
    if (candidate.hyphaId === selfHyphaId) continue
    const dist = vec3Length(subVec3(candidate.position, tip))
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  const angle = angleOf(tip)
  const ringFallback = nearestRingOrSpore(rings, radius, angle)
  const ringDist = vec3Length(subVec3(ringFallback.position, tip))
  if (best && bestDist <= ringDist) return { position: best.position, kind: 'hypha' }
  return { position: ringFallback.position, kind: ringFallback.kind }
}

/**
 * Grows one hypha's polyline from `baseAngle` (where it sprouts, at
 * `radiusForTime(draft.splitTime)`) to `targetAngle` (its own author-sector
 * angle, at `radiusForTime(draft.endTime)`). Disc-radius is recomputed
 * directly from each sample's own real time (never lerped between the two
 * endpoints), so it is *exactly* the real time -> radius mapping at every
 * point -- monotonic non-decreasing by construction, not just approximately.
 */
function growHyphaCurve(draft: HyphaDraft, baseAngle: number, rawTargetAngle: number, radiusForTime: (time: number) => number, sectorWidth: number, prng: Prng): HyphaPoint[] {
  const thicknessStart = radiusForCommitCount(draft.commitCount)
  const thicknessEnd = draft.status === 'fused' ? thicknessStart * 0.85 : draft.status === 'dead_end' ? thicknessStart * 0.35 : thicknessStart * 0.7

  const curlAmplitude = sectorWidth * randRange(prng, CURL_AMPLITUDE_MIN_FRACTION, CURL_AMPLITUDE_MAX_FRACTION)
  const curlFreq = randRange(prng, CURL_FREQ_MIN, CURL_FREQ_MAX)
  const curlPhase = randRange(prng, 0, CURL_PHASE_MAX)
  // Unwrap once: interpolate/emit using whichever numeric representation of
  // `targetAngle` is closest to `baseAngle` (see `shortestAngleTo`), so the
  // curve always turns the short way -- `polarToVec3` is periodic, so the
  // final Cartesian position is identical either way.
  const targetAngle = shortestAngleTo(baseAngle, rawTargetAngle)

  const points: HyphaPoint[] = []
  for (let i = 0; i < GROWTH_SAMPLES; i++) {
    const t = i / (GROWTH_SAMPLES - 1)
    const time = lerp(draft.splitTime, draft.endTime, t)
    const radius = radiusForTime(time)
    // 0 at both ends (tangent-ish continuity with the real attach point and
    // a clean approach to the tip), peaking mid-curve -- an organic wobble,
    // never enough to fight the monotonic radial growth.
    const envelope = Math.sin(Math.PI * t)
    const curl = i === 0 || i === GROWTH_SAMPLES - 1 ? 0 : curlAmplitude * Math.sin(curlFreq * Math.PI * t + curlPhase) * envelope
    const angle = lerp(baseAngle, targetAngle, easeInOutCubic(t)) + curl
    const y = randJitter(prng, Y_JITTER * envelope)
    const thickness = Math.max(lerp(thicknessStart, thicknessEnd, t), 0.001)
    points.push({ position: polarToVec3(angle, radius, y), radius: thickness, time })
  }
  // Endpoints exact: no curl, angle pinned to baseAngle/targetAngle.
  points[0] = { position: polarToVec3(baseAngle, radiusForTime(draft.splitTime), 0), radius: thicknessStart, time: draft.splitTime }
  points[points.length - 1] = { position: polarToVec3(targetAngle, radiusForTime(draft.endTime), 0), radius: thicknessEnd, time: draft.endTime }
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
 * `HyphaDraft`s). Deterministic for a fixed seed. See the module doc above
 * for the mapping.
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
  // Unlike the spiral layout, colony deliberately does NOT blend in the
  // activity-weighted CDF (see `buildActivityCdf`/M2b): a growth ring is
  // meant to be an honest, roughly-even function of real elapsed time, and
  // the activity blend's "more room where activity is dense" behavior has
  // the opposite effect a *concentric* radius needs -- a long quiet stretch
  // barely advances the CDF, so everything born in it collapses onto nearly
  // one radius, reading as an unnaturally bright/dense ring rather than a
  // calm quiet season (found in round 2 of the visual iteration on
  // `expressjs/express`, see the M2c progress notes). Pure eased time keeps
  // "distance from center == time" exactly, not density-weighted.
  const radiusForTime = (time: number): number => radiusForFrac(timeToFrac(time, bounds))

  const spore: Spore = { id: 'spore', kind: 'spore', time: bounds.firstEventTime, ref: main.ref, position: vec3(0, 0, 0) }
  const rings = buildColonyRings(releases, bounds, radiusForTime)

  const sectors = buildAuthorSectors(hyphae)
  const angularSlots = assignAngularSlots(hyphae, sectors, seed)

  // Colony has no rendered main curve (the disc/rings/spore ARE the colony)
  // -- this degenerate 2-point entry exists only so `main` stays a
  // lookupable `Hypha` (branch detail, id `hypha-main`) like the spiral
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
  const grid = new RadiusGrid()
  const orderedDrafts = [...hyphae].sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))

  const nodes: NetworkNode[] = []
  const tips: Tip[] = []
  const fusions: Fusion[] = []
  const nodesOmittedByHypha: Record<string, number> = {}

  function insertPointsIntoGrid(hyphaId: string, sectorKey: string, points: HyphaPoint[]): void {
    for (const point of points) {
      const radius = vec3Length(point.position)
      grid.insert({ position: point.position, hyphaId, sectorKey }, radius)
    }
  }

  for (const draft of orderedDrafts) {
    const slot = angularSlots.get(draft.id)
    const targetAngle = slot?.angle ?? 0
    const sectorWidth = slot?.sector.angleWidth ?? Math.PI * 2
    const sectorKey = resolveSectorKey(draft.author.login, sectors)

    const isColonyAttached = draft.parentHyphaId === null || draft.parentHyphaId === main.id
    const attachment: 'colony' | 'parent-branch' = isColonyAttached ? 'colony' : 'parent-branch'

    const r0 = radiusForTime(draft.splitTime)
    let baseAngle: number
    if (isColonyAttached) {
      const anchor = findSproutAnchor(grid, sectorKey, r0, targetAngle, rings)
      baseAngle = angleOf(anchor.position)
    } else {
      const parentHypha = positionedById.get(draft.parentHyphaId!) ?? mainHypha
      const attach = pointOnHyphaAtTime(parentHypha.points, draft.splitTime)
      baseAngle = angleOf(attach.position)
    }

    const points = growHyphaCurve(draft, baseAngle, targetAngle, radiusForTime, sectorWidth, prng)

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
    insertPointsIntoGrid(draft.id, sectorKey, points)

    const { kept, omitted } = capEvenly(draft.commits, resolved.maxNodesPerHypha)
    if (omitted > 0) nodesOmittedByHypha[draft.id] = omitted
    for (const commit of kept) {
      const at = pointOnHyphaAtTime(points, commit.time)
      nodes.push({
        id: `node-${draft.id}-${commit.ref.type}-${commit.ref.id}`,
        kind: 'node',
        hyphaId: draft.id,
        time: commit.time,
        ref: commit.ref,
        position: at.position,
        radius: Math.max(at.radius, 0.006),
        isMergePoint: commit.isMergePoint,
      })
    }

    if (draft.status === 'fused') {
      const tipPoint = points[points.length - 1]!
      const r1 = vec3Length(tipPoint.position)
      const bridge = findFusionAnchor(grid, draft.id, tipPoint.position, r1, rings)
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

  // "Commit = hair ... keep M2b's hair element": every PR-hypha commit node
  // gets the same lateral-filament hair the spiral layout uses (tangent to
  // its own hypha's curve at that point). A genuine direct-commit node on
  // `main` instead gets the radially-outward "spur" variant the task brief
  // calls for (`buildDirectCommitSpurs`, below) -- `main` has no rendered
  // curve/tangent in the colony layout to hang a lateral hair off of.
  const prHairPrng = createPrng(`${seed}:network-colony-hairs`)
  const prNodes = nodes.filter((n) => n.hyphaId !== main.id)
  const prHairs = buildPrHairs(prNodes, positionedById, prHairPrng)

  const spurs = buildDirectCommitSpurs(main, sectors, radiusForTime, seed)
  for (const node of spurs.nodes) nodes.push(node)

  const mushrooms = buildMushroomsOnRings(releases, radiusForTime, seed)

  return {
    spore,
    hyphae: [mainHypha, ...orderedDrafts.map((d) => positionedById.get(d.id)!)],
    nodes,
    tips,
    hairs: [...prHairs, ...spurs.hairs],
    rings,
    fusions,
    mushrooms,
    nodesOmittedByHypha,
  }
}

function rotateAroundY(v: Vec3, angleRadians: number): Vec3 {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return vec3(v.x * cos - v.z * sin, v.y, v.x * sin + v.z * cos)
}

/**
 * One lateral hair per rendered PR-hypha commit node -- identical mechanism
 * to the spiral layout's `buildHairs` (perpendicular to the hypha's own
 * local tangent, alternating side, seeded jitter, a touch longer for a
 * merge-point commit), reused here per the task brief ("keep M2b's hair
 * element"). Excludes `main`'s direct-commit nodes, which get the separate
 * radially-outward "spur" treatment instead (`buildDirectCommitSpurs`).
 */
function buildPrHairs(nodes: NetworkNode[], positionedById: Map<string, Hypha>, prng: Prng): Hair[] {
  const hairs: Hair[] = []
  nodes.forEach((node, index) => {
    const points = positionedById.get(node.hyphaId)?.points ?? []
    const basis = pointOnHyphaAtTime(points, node.time)
    const perp = normalizeVec3(vec3(-basis.tangent.z, 0, basis.tangent.x))
    const sideSign = index % 2 === 0 ? 1 : -1
    const angleJitter = randJitter(prng, HAIR_ANGLE_JITTER)
    const direction = normalizeVec3(rotateAroundY(perp, angleJitter * sideSign))

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

/**
 * "Direct commits to the default branch = short radial spurs at their time
 * radius, placed in their author's sector" -- one `NetworkNode` (for
 * lookup/detail, `hyphaId: main.id`) plus one real radially-outward `Hair`
 * per genuine direct commit (merge-point pseudo-entries on `main.commits`
 * are excluded -- those already get a fusion knot on their own PR hypha).
 */
function isDirectCommitWithAuthor(c: HyphaCommitDraft): c is HyphaCommitDraft & { author: CommitAuthor } {
  return c.ref.type === 'commit' && !c.isMergePoint && c.author !== undefined
}

function buildDirectCommitSpurs(main: HyphaDraft, sectors: ReturnType<typeof buildAuthorSectors>, radiusForTime: (time: number) => number, seed: string): { nodes: NetworkNode[]; hairs: Hair[] } {
  const directCommits = main.commits.filter(isDirectCommitWithAuthor)
  if (directCommits.length === 0) return { nodes: [], hairs: [] }

  const prng = createPrng(`${seed}:network-colony-spurs`)
  const bySector = new Map<string, { id: string; splitTime: number; endTime: number; ref: NetworkRef; time: number }[]>()
  for (const commit of directCommits) {
    const key = resolveSectorKey(commit.author.login, sectors)
    const list = bySector.get(key) ?? []
    list.push({ id: commit.ref.id, splitTime: commit.time, endTime: commit.time, ref: commit.ref, time: commit.time })
    bySector.set(key, list)
  }

  const nodes: NetworkNode[] = []
  const hairs: Hair[] = []
  for (const [key, members] of bySector) {
    const sector = sectors.get(key)
    if (!sector) continue
    const slots = assignSlotsWithinGroup(members)
    for (const member of members) {
      const { slot, slotCount } = slots.get(member.id)!
      const slotWidth = sector.angleWidth / slotCount
      const angle = sector.angleStart + slotWidth * (slot + 0.5) + randJitter(prng, slotWidth * 0.2)
      const radius = radiusForTime(member.time)
      const position = polarToVec3(angle, radius, 0)
      const nodeId = `node-${main.id}-commit-${member.ref.id}`
      nodes.push({ id: nodeId, kind: 'node', hyphaId: main.id, time: member.time, ref: member.ref, position, radius: 0.006, isMergePoint: false })

      const outward = normalizeVec3(position, vec3(1, 0, 0))
      const angleJitter = randJitter(prng, SPUR_ANGLE_JITTER)
      const cos = Math.cos(angleJitter)
      const sin = Math.sin(angleJitter)
      const direction = vec3(outward.x * cos - outward.z * sin, 0, outward.x * sin + outward.z * cos)
      const length = clamp(SPUR_LENGTH_MIN + randJitter(prng, SPUR_LENGTH_JITTER) + (SPUR_LENGTH_MAX - SPUR_LENGTH_MIN) * logScale(radius, 0, DISC_MAX_RADIUS), SPUR_LENGTH_MIN * 0.5, SPUR_LENGTH_MAX)
      hairs.push({
        id: `hair-${nodeId}`,
        kind: 'hair',
        hyphaId: main.id,
        nodeId,
        time: member.time,
        ref: member.ref,
        position,
        direction,
        length,
        baseRadius: Math.max(0.006 * SPUR_BASE_RADIUS_FRACTION, SPUR_MIN_BASE_RADIUS),
      })
    }
  }
  return { nodes, hairs }
}
