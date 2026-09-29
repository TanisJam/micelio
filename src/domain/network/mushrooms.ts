import type { ReleaseInfo } from '../repo'
import { polarToVec3, type Vec3 } from '../shared/vector'
import { createPrng, randRange } from '../shared/prng'
import { discRadius } from './ringGeometry'
import type { Hypha, Mushroom, NetworkRef } from './types'

/**
 * One mushroom per release, fruiting on its release's own growth ring
 * (`buildMushroomsOnRings`, the colony layout -- M4 removed the earlier
 * spiral layout's own placement function, `buildMushrooms`). Releases close
 * in time cluster into a small group (individual mushrooms, shared
 * `clusterId`) instead of overlapping exactly. `computeReleaseSequence`
 * holds the ordering/clustering/scale logic.
 */

const MUSHROOM_LIFT = 0.16
/** "Small time window" (item 1 of the final polish pass' Unit 2, "detect bursts"): releases within this gap of their immediate time-neighbor burst together into one fairy ring (`buildMushroomsOnRings`, `layoutBurstRing`). */
const MUSHROOM_CLUSTER_GAP_MS = 1000 * 60 * 60 * 24 * 3 // releases within 3 days cluster together
/**
 * The golden angle (~137.5deg), the same constant
 * phyllotaxis uses to spread leaves/seeds around a stem with minimal
 * overlap at any radius. Each non-clustered release's angle is
 * `ownOrderIndex * GOLDEN_ANGLE_RADIANS` (see `buildMushroomsOnRings`) --
 * deterministic, index-only, and independent of which hypha it happens to
 * be near, so releases are dotted evenly across the whole disc instead of
 * bunching wherever early colony growth (or a long-lived branch) happens to
 * put their `nearPr` anchor. `nearPr` itself is untouched -- it's still the
 * real closest-preceding-merge data link the detail panel shows, just no
 * longer read for placement.
 */
export const MUSHROOM_GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5))
/** Colony layout only: small deterministic per-mushroom angular jitter (radians) so the golden-angle sequence doesn't read as a perfectly mechanical spiral. */
export const MUSHROOM_ANGLE_JITTER = 0.08
/** Colony layout only: the minimum angular gap (radians) enforced between two mushrooms whose ring radii fall within `MUSHROOM_RADIUS_SEPARATION_WINDOW` of each other (`enforceMinAngularSeparation`) -- a deterministic safety net on top of the golden angle's own good spacing, for the rare case several release indices alias to nearly the same angle. */
export const MUSHROOM_MIN_ANGULAR_SEPARATION = 0.3
/** Colony layout only: how close (world units, disc radius 0..`DISC_MAX_RADIUS`) two mushrooms' rings have to be before the minimum-separation rule applies to them at all -- mushrooms whose radii are already far apart never fight over angle. */
export const MUSHROOM_RADIUS_SEPARATION_WINDOW = 0.2
const MUSHROOM_SCALE_PATCH = 0.55
const MUSHROOM_SCALE_MINOR = 0.75
const MUSHROOM_SCALE_MAJOR = 1.05
const MUSHROOM_SCALE_UNKNOWN = 0.7

// --- Final polish pass, Unit 2: burst layout ("fairy rings") --------------
/**
 * Nominal world-unit mushroom cap RADIUS at `scale === 1`, mirroring the
 * render-time constants that actually draw a mushroom (`mushroomInstances.
 * ts`'s `BASE_SCALE`, 0.12, times `mushroomGeometry.ts`'s cap profile's own
 * max local radius, ~0.56 -- `0.12 * 0.56 = 0.0672`). Duplicated here (not
 * imported) because this module must stay three.js-free; if either render-
 * time constant changes, update this too. Used only to size a burst's ring
 * radius (`layoutBurstRing`) so real rendered caps don't overlap -- never
 * used for actual rendering.
 */
export const MUSHROOM_CAP_WORLD_RADIUS_AT_SCALE_1 = 0.0672
export function mushroomCapWorldRadius(scale: number): number {
  return MUSHROOM_CAP_WORLD_RADIUS_AT_SCALE_1 * scale
}
/** Extra world-unit margin added on top of two adjacent caps' own radii, so a burst ring's neighbors read as visibly separate mushrooms rather than edge-touching. */
const BURST_RING_CAP_MARGIN = 0.012

export interface BurstRingOffset {
  /** Local XZ offset (world units) from the burst's shared center point. */
  dx: number
  dz: number
}

/**
 * Lays a burst's members evenly around a small ring -- a literal "fairy
 * ring" (real fungi fruit in circles around a shared point) instead of the
 * lumpy pile a naive per-member random scatter produces for a large burst
 * (item 2 of the final polish pass: express's own ~16-release burst was the
 * motivating case). Ring radius is chosen so NO two adjacent members' own
 * rendered caps overlap (`mushroomCapWorldRadius` + `BURST_RING_CAP_MARGIN`)
 * -- the worst-case (largest) pair sets one shared ring radius, since an
 * evenly-spaced ring only has one spacing to solve for. A single-member
 * "burst" (`n <= 1`) returns one zero offset -- singles stay single, exactly
 * at the shared center. Pure and deterministic: no PRNG here at all (the
 * caller's own small per-member angular jitter, if any, is applied
 * separately) -- same `capScales` in the same order always produces the
 * same ring.
 */
export function layoutBurstRing(capScales: number[]): BurstRingOffset[] {
  const n = capScales.length
  if (n <= 1) return capScales.map(() => ({ dx: 0, dz: 0 }))

  const maxCapRadius = Math.max(...capScales.map(mushroomCapWorldRadius))
  const minChord = 2 * maxCapRadius + BURST_RING_CAP_MARGIN
  const halfAngleStep = Math.PI / n
  const ringRadius = minChord / (2 * Math.sin(halfAngleStep))

  return capScales.map((_, i) => {
    const angle = (i / n) * Math.PI * 2
    return { dx: Math.cos(angle) * ringRadius, dz: Math.sin(angle) * ringRadius }
  })
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2
  return ((angle % twoPi) + twoPi) % twoPi
}

/** Shortest signed angular distance from `a` to `b`, in `(-PI, PI]`. */
function angularDelta(a: number, b: number): number {
  let delta = (b - a) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

export interface AngledRingEntry {
  angle: number
  radius: number
}

/**
 * Deterministically nudges angles so no two entries whose ring radius is
 * within `radiusWindow` of each other end up closer than `minSeparation`
 * radians apart. Processes entries in ascending-radius order and only ever
 * pushes an entry forward (in the golden-angle direction) away from an
 * already-finalized, closer-in-radius neighbor, so the result depends only
 * on the input values, never on call order or iteration timing -- pure and
 * exported for testing.
 */
export function enforceMinAngularSeparation(entries: AngledRingEntry[], minSeparation: number, radiusWindow: number): number[] {
  const order = entries.map((_, i) => i).sort((a, b) => entries[a]!.radius - entries[b]!.radius)
  const angles: number[] = new Array(entries.length)
  const finalized: number[] = []

  // Processes strictly in ascending-radius order: each entry is checked
  // against every ALREADY-FINALIZED peer within `radiusWindow` (never a
  // later one) and nudged until none conflict, before moving on -- earlier
  // entries are never revisited. A first attempt that only checked the
  // single nearest-radius neighbor (and pushed exactly onto `neighbor.angle
  // + minSeparation`) could resolve that one neighbor and then, while fixing
  // a farther one, land two DIFFERENT entries on the exact same pushed
  // angle -- a real bug found via a genuine 40-release test failure, not a
  // hypothetical (see `mushrooms.test.ts`).
  for (const i of order) {
    const peers = finalized.filter((p) => entries[i]!.radius - entries[p]!.radius <= radiusWindow)
    let angle = entries[i]!.angle
    // Bounded by the peer count (never data-sized/unbounded growth, and
    // never a `while(true)`) -- each iteration only ever needs to escape one
    // more conflicting peer, so `peers.length` attempts always suffices.
    for (let iteration = 0; iteration < peers.length + 1; iteration++) {
      const conflict = peers.find((p) => Math.abs(angularDelta(angles[p]!, angle)) < minSeparation)
      // `find` can return the valid peer INDEX `0` -- a falsy number, not
      // "nothing found" -- so this must check `undefined` explicitly, not
      // just truthiness (a real bug caught by this file's own first test
      // case, whose only peer is index 0).
      if (conflict === undefined) break
      angle = normalizeAngle(angles[conflict]! + minSeparation)
    }
    angles[i] = angle
    finalized.push(i)
  }
  return angles
}

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

/** Parses a `v1.2.3`-ish tag into { major, minor, patch }, or null if it doesn't look like semver. */
function parseSemver(tag: string): { major: number; minor: number; patch: number } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

/** Scale from release "importance": a major bump (or the first-ever release) is a bigger mushroom than a patch. */
function scaleForRelease(release: ReleaseInfo, isFirstOfMajor: boolean): number {
  const semver = parseSemver(release.tag)
  if (!semver) return MUSHROOM_SCALE_UNKNOWN
  if (semver.patch === 0 && semver.minor === 0) return MUSHROOM_SCALE_MAJOR
  if (isFirstOfMajor) return MUSHROOM_SCALE_MAJOR
  if (semver.patch === 0) return MUSHROOM_SCALE_MINOR
  return MUSHROOM_SCALE_PATCH
}

export interface ReleaseSequenceEntry {
  release: ReleaseInfo
  time: number
  scale: number
  /** `true` for the second-and-later member of a cluster -- the caller retroactively tags the first member too. */
  isClustered: boolean
  clusterIndex: number
}

/** Time-ordered releases with cluster grouping and importance scale resolved -- the layout-agnostic part of mushroom placement. */
export function computeReleaseSequence(releases: ReleaseInfo[]): ReleaseSequenceEntry[] {
  const sorted = [...releases].map((release) => ({ release, time: toEpochMs(release.date) })).sort((a, b) => a.time - b.time)

  const seenMajors = new Set<number>()
  let previousTime: number | null = null
  let clusterIndex = 0
  const entries: ReleaseSequenceEntry[] = []

  for (const { release, time } of sorted) {
    const semver = parseSemver(release.tag)
    const isFirstOfMajor = semver ? !seenMajors.has(semver.major) : false
    if (semver) seenMajors.add(semver.major)

    const isClustered = previousTime !== null && time - previousTime <= MUSHROOM_CLUSTER_GAP_MS
    if (!isClustered) clusterIndex += 1
    previousTime = time

    entries.push({ release, time, scale: scaleForRelease(release, isFirstOfMajor), isClustered, clusterIndex })
  }
  return entries
}

/**
 * Colony layout (M2c/M2d, angle placement redone M3c, burst layout redone
 * Unit 2 of the final polish pass): places each mushroom on its release's
 * own growth ring -- for a STANDALONE release (no other release within
 * `MUSHROOM_CLUSTER_GAP_MS`), `radiusForTime(entry.time)` is the exact same
 * time -> radius mapping the colony's hyphae use, so "mushrooms sit on their
 * release ring" holds exactly for it (`polarToVec3` always sets XZ magnitude
 * to the given radius). A BURST (several releases close in time -- item 1 of
 * Unit 2, "detect bursts") shares one ring radius/angle instead, at the
 * burst's own mean ("group center") time, and lays its members out as a
 * small fairy ring around that shared point (`layoutBurstRing`) rather than
 * each member computing its own, nearly-identical individual radius/angle --
 * see that function's own doc comment for why a naive per-member approach
 * reads as a lumpy pile for a real bursty release train (item 5 of the M3c
 * brief this replaces cited "a pile of overlapping mushrooms" as the
 * original finding; Unit 2's own motivating case was express's own ~16-
 * release burst).
 *
 * The ring's ANGLE (M3c, now per-BURST rather than per-release) is the
 * golden-angle sequence (`MUSHROOM_GOLDEN_ANGLE_RADIANS`) ordered by each
 * burst's own position in time, with a deterministic minimum-separation pass
 * (`enforceMinAngularSeparation`) -- so bursts are dotted evenly across the
 * whole disc instead of piling into one arc wherever `nearPr` happens to
 * anchor (M2d/M3b's angle-from-anchor approach for a bursty release cadence
 * or a long-lived branch). `Mushroom.nearPr` remains the real
 * closest-preceding-merge data link the detail panel shows (`findRingAnchor`,
 * computed per-member at the burst's own shared ring radius) -- honesty is
 * unaffected, only PLACEMENT no longer reads it.
 */
export function buildMushroomsOnRings(releases: ReleaseInfo[], radiusForTime: (time: number) => number, hyphae: Hypha[], seed: string): Mushroom[] {
  if (releases.length === 0) return []
  const prng = createPrng(`${seed}:mushrooms-colony`)
  const sequence = computeReleaseSequence(releases)

  // Item 1 ("detect bursts"): `computeReleaseSequence` already assigns a
  // shared `clusterIndex` to every run of releases within
  // `MUSHROOM_CLUSTER_GAP_MS` of their immediate time-neighbor -- grouping
  // by that index recovers each burst (and every standalone release as its
  // own one-member "burst") in time order, since `sequence` is already
  // sorted by time (a `Map`'s insertion order is preserved on iteration).
  const groups = new Map<number, ReleaseSequenceEntry[]>()
  for (const entry of sequence) {
    const members = groups.get(entry.clusterIndex)
    if (members) members.push(entry)
    else groups.set(entry.clusterIndex, [entry])
  }

  interface PlacedGroup {
    members: ReleaseSequenceEntry[]
    angle: number
    radius: number
  }
  const placedGroups: PlacedGroup[] = []
  let groupOrder = 0
  for (const members of groups.values()) {
    const centerTime = members.reduce((sum, m) => sum + m.time, 0) / members.length
    const radius = radiusForTime(centerTime)
    const jitter = randRange(prng, -MUSHROOM_ANGLE_JITTER, MUSHROOM_ANGLE_JITTER)
    const angle = normalizeAngle(groupOrder * MUSHROOM_GOLDEN_ANGLE_RADIANS + jitter)
    placedGroups.push({ members, angle, radius })
    groupOrder += 1
  }

  // Deterministic safety net (unchanged from M3c) for the rare case two
  // BURSTS' own golden-angle indices still alias to a similar angle at a
  // similar radius -- operates on burst centers now, not individual releases.
  const separatedAngles = enforceMinAngularSeparation(placedGroups, MUSHROOM_MIN_ANGULAR_SEPARATION, MUSHROOM_RADIUS_SEPARATION_WINDOW)
  placedGroups.forEach((group, i) => {
    group.angle = separatedAngles[i]!
  })

  const mushrooms: Mushroom[] = []
  for (const { members, angle, radius } of placedGroups) {
    // "Singles stay single" (item "singles stay single"): a one-member group
    // gets `clusterId: null`, exactly as a standalone release always has.
    const clusterId = members.length > 1 ? `mushroom-cluster-${members[0]!.clusterIndex}` : null
    const ringOffsets = layoutBurstRing(members.map((member) => member.scale))
    const center = polarToVec3(angle, radius, MUSHROOM_LIFT)

    members.forEach((entry, i) => {
      const offset = ringOffsets[i]!
      const position: Vec3 = { x: center.x + offset.dx, y: center.y, z: center.z + offset.dz }
      // Each member keeps its own, individually-honest `nearPr` (computed at
      // the burst's own shared ring radius, since that's where it actually
      // renders) -- still real data, never inherited/faked from a sibling.
      const anchor = findRingAnchor(hyphae, entry.time, radius)
      mushrooms.push(makeMushroom(entry, position, clusterId, anchor.nearPr))
    })
  }

  return mushrooms
}

interface RingAnchor {
  /** The real closest-preceding-merge data link (`Mushroom.nearPr`, shown in the detail panel) -- unaffected by the M3c golden-angle placement change below. `null` when no real crossing hypha was found (honest visual-only fallback). */
  nearPr: NetworkRef | null
}

/** A hypha's own start/end disc radius (ignores tube thickness), from its already-grown points. */
function hyphaRadiusSpan(hypha: Hypha): { start: number; end: number } {
  return { start: discRadius(hypha.points[0]!.position), end: discRadius(hypha.points[hypha.points.length - 1]!.position) }
}

/** See `buildMushroomsOnRings`'s doc comment: this only resolves the honest `nearPr` data link (M3c decoupled placement ANGLE from it -- see `MUSHROOM_GOLDEN_ANGLE_RADIANS`). */
function findRingAnchor(hyphae: Hypha[], releaseTime: number, ringRadius: number): RingAnchor {
  let closestMergedBefore: Hypha | null = null
  for (const hypha of hyphae) {
    if (hypha.kind === 'main' || hypha.status !== 'fused') continue
    if (hypha.endTime > releaseTime) continue
    if (!closestMergedBefore || hypha.endTime > closestMergedBefore.endTime) closestMergedBefore = hypha
  }
  if (closestMergedBefore) {
    const span = hyphaRadiusSpan(closestMergedBefore)
    if (ringRadius >= span.start - 1e-6 && ringRadius <= span.end + 1e-6) {
      return { nearPr: closestMergedBefore.ref }
    }
  }

  // No fused merged PR's own span reaches this ring -- honest fallback, no
  // data link (M3c: the angle this used to also supply is no longer read
  // here at all, see `MUSHROOM_GOLDEN_ANGLE_RADIANS`).
  return { nearPr: null }
}

function makeMushroom(entry: ReleaseSequenceEntry, position: Vec3, clusterId: string | null, nearPr: NetworkRef | null): Mushroom {
  const ref: NetworkRef = { type: 'release', id: entry.release.tag }
  return {
    id: `mushroom-${entry.release.tag}`,
    kind: 'mushroom',
    time: entry.time,
    ref,
    position,
    scale: entry.scale,
    clusterId,
    nearPr,
  }
}
