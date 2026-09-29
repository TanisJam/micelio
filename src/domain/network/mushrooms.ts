import type { ReleaseInfo } from '../repo'
import { polarToVec3, type Vec3 } from '../shared/vector'
import { createPrng, randJitter, randRange } from '../shared/prng'
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
const MUSHROOM_CLUSTER_GAP_MS = 1000 * 60 * 60 * 24 * 3 // releases within 3 days cluster together
/** Angular scatter (radians) for a clustered mushroom around its ring anchor angle. */
export const MUSHROOM_CLUSTER_ANGLE_SCATTER = 0.24
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
 * Colony layout (M2c/M2d, angle placement redone M3c): places each mushroom
 * exactly on its release's own growth ring -- `radiusForTime(entry.time)` is
 * the exact same time -> radius mapping the colony's hyphae use, so
 * "mushrooms sit on their release ring" holds exactly (`polarToVec3` always
 * sets XZ magnitude to the given radius; radius is still 100% time-honest).
 *
 * The ring's ANGLE (M3c) is the golden-angle sequence
 * (`MUSHROOM_GOLDEN_ANGLE_RADIANS`) ordered by each non-clustered release's
 * own position in time, with a deterministic minimum-separation pass
 * (`enforceMinAngularSeparation`) -- so releases are dotted evenly across the
 * whole disc instead of piling into one arc wherever `nearPr` happens to
 * anchor (M2d/M3b's angle-from-anchor approach for a bursty release cadence
 * or a long-lived branch). `Mushroom.nearPr` remains the real
 * closest-preceding-merge data link the detail panel shows (`findRingAnchor`)
 * -- honesty is unaffected, only PLACEMENT no longer reads it. Clustered
 * releases share one base angle (scattered around it) but each still gets
 * its own honestly-computed `nearPr`.
 */
export function buildMushroomsOnRings(releases: ReleaseInfo[], radiusForTime: (time: number) => number, hyphae: Hypha[], seed: string): Mushroom[] {
  if (releases.length === 0) return []
  const prng = createPrng(`${seed}:mushrooms-colony`)
  const sequence = computeReleaseSequence(releases)

  // A busy release train can chain many entries into one cluster (item 5:
  // "cluster close releases") -- independently-random per-member scatter
  // (the original approach) can by chance pile several members into nearly
  // the same spot ("a pile of overlapping mushrooms", round 2 orchestrator
  // feedback), especially for a large cluster. Fanning members evenly
  // across the scatter window by their own position in the cluster (plus a
  // little jitter) keeps every member visually distinct while the cluster
  // as a whole still reads as one small, tightly-grouped patch.
  const clusterSizes = new Map<number, number>()
  for (const entry of sequence) clusterSizes.set(entry.clusterIndex, (clusterSizes.get(entry.clusterIndex) ?? 0) + 1)
  const clusterMemberSeen = new Map<number, number>()

  // Item 1 of the M3c visual brief: releases were spreading only as far as
  // their real `nearPr` anchor's own crossing angle (fanned a little for a
  // repeated anchor), which for a bursty release cadence or a long-lived
  // branch means most of a repo's ~80 releases resolve to the same handful
  // of anchors and visually pile into one arc along a single arm of the
  // colony -- not "dotted across the galaxy". `nearPr` stays exactly as
  // honest as before (still the real closest-preceding-merge link the
  // detail panel shows); only the ANGLE used for placement is decoupled
  // from it, via the golden-angle sequence (`MUSHROOM_GOLDEN_ANGLE_RADIANS`)
  // ordered by each non-clustered release's own position in time -- and
  // `enforceMinAngularSeparation` below is a deterministic safety net for
  // the rare case two release indices still alias to a similar angle at a
  // similar radius.
  interface PrimaryAngle {
    index: number
    nearPr: NetworkRef | null
    angle: number
    radius: number
  }
  const primaries: PrimaryAngle[] = []
  let primaryOrder = 0
  sequence.forEach((entry, index) => {
    if (entry.isClustered) return
    const radius = radiusForTime(entry.time)
    const anchor = findRingAnchor(hyphae, entry.time, radius)
    const jitter = randRange(prng, -MUSHROOM_ANGLE_JITTER, MUSHROOM_ANGLE_JITTER)
    const angle = normalizeAngle(primaryOrder * MUSHROOM_GOLDEN_ANGLE_RADIANS + jitter)
    primaries.push({ index, nearPr: anchor.nearPr, angle, radius })
    primaryOrder += 1
  })

  const separatedAngles = enforceMinAngularSeparation(primaries, MUSHROOM_MIN_ANGULAR_SEPARATION, MUSHROOM_RADIUS_SEPARATION_WINDOW)
  primaries.forEach((primary, i) => {
    primary.angle = separatedAngles[i]!
  })

  const angleByIndex = new Map(primaries.map((p) => [p.index, p.angle]))
  const nearPrByIndex = new Map(primaries.map((p) => [p.index, p.nearPr]))

  const mushrooms: Mushroom[] = []
  let clusterId: string | null = null
  let clusterAngle: number | null = null
  let clusterNearPr: NetworkRef | null = null

  sequence.forEach((entry, index) => {
    // Real bug found while building this (M3c): only `clusterId` was reset
    // here for a standalone entry -- `clusterAngle`/`clusterNearPr` stayed
    // set from whichever earlier entry last assigned them, so EVERY
    // standalone entry after the first silently inherited the previous
    // entry's angle instead of its own (`angle: number = clusterAngle ??
    // primaryAngle ?? ...` always short-circuited on the stale
    // `clusterAngle`) -- the only reason releases still ended up at visually
    // distinct angles at all was the small `randJitter` scatter added below,
    // which was never gated on `entry.isClustered` either. This is the root
    // cause of the "80 releases form one big arc" finding: the M2d/M3b
    // per-run fan logic this replaced was never actually being applied to
    // more than the first entry of the whole sequence.
    if (!entry.isClustered) {
      clusterId = null
      clusterAngle = null
      clusterNearPr = null
    }

    const radius = radiusForTime(entry.time)
    const primaryAngle = angleByIndex.get(index)
    const angle: number = clusterAngle ?? primaryAngle ?? normalizeAngle(index * MUSHROOM_GOLDEN_ANGLE_RADIANS)
    const nearPr = nearPrByIndex.has(index) ? (nearPrByIndex.get(index) ?? null) : clusterNearPr

    let scatterAngle = 0
    if (clusterAngle !== null) {
      const clusterSize = clusterSizes.get(entry.clusterIndex) ?? 1
      const memberIndex = clusterMemberSeen.get(entry.clusterIndex) ?? 0
      clusterMemberSeen.set(entry.clusterIndex, memberIndex + 1)
      const fanFraction = clusterSize > 1 ? memberIndex / (clusterSize - 1) - 0.5 : 0
      scatterAngle = fanFraction * 2 * MUSHROOM_CLUSTER_ANGLE_SCATTER + randJitter(prng, MUSHROOM_CLUSTER_ANGLE_SCATTER * 0.15)
    }
    const position = polarToVec3(angle + scatterAngle, radius, MUSHROOM_LIFT)

    if (entry.isClustered && clusterId === null) {
      clusterId = `mushroom-cluster-${entry.clusterIndex}`
      const prev = mushrooms[mushrooms.length - 1]
      if (prev) prev.clusterId = clusterId
      clusterAngle = angle
      clusterNearPr = nearPr
    } else if (!entry.isClustered) {
      clusterAngle = angle
      clusterNearPr = nearPr
    }

    mushrooms.push(makeMushroom(entry, position, clusterId, nearPr))
  })

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
