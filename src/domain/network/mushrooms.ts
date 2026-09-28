import type { ReleaseInfo } from '../repo'
import { addVec3, polarToVec3, vec3, type Vec3 } from '../tree/vector'
import { createPrng, randJitter, randRange } from '../tree/prng'
import { discRadius, pointOnHyphaAtRadius, pointOnHyphaAtTime } from './layout'
import type { Hypha, HyphaPoint, Mushroom, NetworkRef } from './types'

/**
 * One mushroom per release, fruiting on the soil surface above its point on
 * the main hypha (spiral layout) or on its release growth ring (colony
 * layout, `buildMushroomsOnRings`). Releases close in time cluster into a
 * small group (individual mushrooms, shared `clusterId`) instead of
 * overlapping exactly. `computeReleaseSequence` holds the layout-agnostic
 * ordering/clustering/scale logic shared by both placement strategies.
 */

const MUSHROOM_LIFT = 0.16
const MUSHROOM_CLUSTER_GAP_MS = 1000 * 60 * 60 * 24 * 3 // releases within 3 days cluster together
/** Exported for tests: a clustered mushroom's XZ position is real-data-anchored -- offset from its anchor point by at most this much. */
export const MUSHROOM_CLUSTER_SCATTER = 0.05
/** Colony layout only: angular scatter (radians) for a clustered mushroom around its ring anchor angle. */
export const MUSHROOM_CLUSTER_ANGLE_SCATTER = 0.24
/** Colony layout only: target angular gap (radians) between adjacent members of a same-direction run (see `ANGLE_PROXIMITY_RADIANS`) -- scales the run's total spread with its size instead of always using one fixed arc, so a small run of 2-3 doesn't get spread as wide as a real 79-long early-growth chain would. */
export const REPEATED_ANCHOR_GAP = 0.08
/** Colony layout only: hard ceiling (radians) on a run's total spread, regardless of size -- real early-colony growth can chain many dozens of releases into one run (an honest property of the real data, not fabricated), so this still caps out at a wide-but-bounded arc (~130deg) rather than spanning the whole circle. */
export const REPEATED_ANCHOR_MAX_SPREAD = 2.3
/** Colony layout only: how close (radians) two consecutive releases' own real anchor angles have to be before they're treated as "the same direction" and folded into a spread-out run. */
export const ANGLE_PROXIMITY_RADIANS = 0.3
const MUSHROOM_SCALE_PATCH = 0.55
const MUSHROOM_SCALE_MINOR = 0.75
const MUSHROOM_SCALE_MAJOR = 1.05
const MUSHROOM_SCALE_UNKNOWN = 0.7

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

export function buildMushrooms(releases: ReleaseInfo[], mainPoints: HyphaPoint[], seed: string): Mushroom[] {
  if (releases.length === 0) return []
  const prng = createPrng(`${seed}:mushrooms`)
  const sequence = computeReleaseSequence(releases)

  const mushrooms: Mushroom[] = []
  let clusterId: string | null = null
  let clusterAnchor: Vec3 | null = null

  for (const entry of sequence) {
    if (!entry.isClustered) {
      clusterId = null
      clusterAnchor = null
    }

    const surfacePoint = pointOnHyphaAtTime(mainPoints, entry.time)
    const anchor: Vec3 = clusterAnchor ?? addVec3(surfacePoint.position, vec3(0, MUSHROOM_LIFT, 0))
    const scatter = clusterAnchor
      ? vec3(randRange(prng, -MUSHROOM_CLUSTER_SCATTER, MUSHROOM_CLUSTER_SCATTER), 0, randRange(prng, -MUSHROOM_CLUSTER_SCATTER, MUSHROOM_CLUSTER_SCATTER))
      : vec3(0, 0, 0)

    if (entry.isClustered && clusterId === null) {
      clusterId = `mushroom-cluster-${entry.clusterIndex}`
      const prev = mushrooms[mushrooms.length - 1]
      if (prev) prev.clusterId = clusterId
      clusterAnchor = anchor
    } else if (!entry.isClustered) {
      clusterAnchor = anchor
    }

    mushrooms.push(makeMushroom(entry, addVec3(anchor, scatter), clusterId, null))
  }

  return mushrooms
}

/**
 * Colony layout (M2c/M2d): places each mushroom exactly on its release's own
 * growth ring -- `radiusForTime(entry.time)` is the exact same time -> radius
 * mapping the colony's hyphae use, so "mushrooms sit on their release ring"
 * holds exactly (`polarToVec3` always sets XZ magnitude to the given
 * radius). The ring's ANGLE is a true data link when possible
 * (`findRingAnchor`, M2d): the merged PR that landed closest before the
 * release, at the point where *that PR's own hypha* actually crosses the
 * ring radius -- recorded honestly as `Mushroom.nearPr`. Falls back to
 * whichever hypha (any kind) happens to cross the ring, then to a seeded
 * angle, when no real link is available -- `nearPr` is `null` in both
 * fallback cases, mirroring `Hypha.attachment`'s honesty framing. Clustered
 * releases share one anchor angle (scattered around it) but each still gets
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

  // Real-world release cadence is bursty relative to merge cadence, and
  // early colony growth hasn't yet spread across the full circle -- both
  // make `findRingAnchor`'s "nearest preceding merge" resolve to the same
  // anchor hypha repeatedly, OR to several DIFFERENT early hyphae that still
  // happen to sit within a narrow angular band. Either way, each individual
  // link is honest (it *is* the real nearest-preceding merge/crossing), but
  // sampling many ring radii along nearly the same angle visually reads as
  // "all these mushrooms sit in a straight line/trail," not as mycelium
  // fruiting across the colony (a real bug found via 3D visual review, M3).
  // Fixed the same way clustered members are already fanned: a run of
  // consecutive *non-clustered* entries whose real anchor angles land within
  // `ANGLE_PROXIMITY_RADIANS` of each other gets spread evenly across a
  // small arc centered on the run's own first real angle, instead of every
  // member landing exactly on (or right next to) that same direction.
  interface PrimaryAngle {
    index: number
    anchor: RingAnchor
    angle: number
  }
  const primaries: PrimaryAngle[] = []
  sequence.forEach((entry, index) => {
    if (entry.isClustered) return
    const radius = radiusForTime(entry.time)
    const anchor = findRingAnchor(hyphae, entry.time, radius)
    const angle = anchor.angle ?? randRange(prng, 0, Math.PI * 2)
    primaries.push({ index, anchor, angle })
  })

  for (let i = 0; i < primaries.length; ) {
    // A pure-fallback (no real crossing at all, `anchorKey === null`) angle
    // is already an independent seeded random draw -- never group those.
    if (primaries[i]!.anchor.anchorKey === null) {
      i += 1
      continue
    }
    const runStartAngle = primaries[i]!.angle
    let j = i + 1
    while (
      j < primaries.length &&
      primaries[j]!.anchor.anchorKey !== null &&
      Math.abs(primaries[j]!.angle - runStartAngle) < ANGLE_PROXIMITY_RADIANS
    )
      j++
    const runSize = j - i
    if (runSize > 1) {
      const spread = Math.min(REPEATED_ANCHOR_MAX_SPREAD, (runSize - 1) * REPEATED_ANCHOR_GAP)
      for (let k = i; k < j; k++) {
        const fanFraction = (k - i) / (runSize - 1) - 0.5
        primaries[k]!.angle = runStartAngle + fanFraction * spread
      }
    }
    i = j
  }

  const angleByIndex = new Map(primaries.map((p) => [p.index, p.angle]))
  const anchorByIndex = new Map(primaries.map((p) => [p.index, p.anchor]))

  const mushrooms: Mushroom[] = []
  let clusterId: string | null = null
  let clusterAngle: number | null = null
  let clusterNearPr: NetworkRef | null = null

  sequence.forEach((entry, index) => {
    if (!entry.isClustered) clusterId = null

    const radius = radiusForTime(entry.time)
    const primaryAngle = angleByIndex.get(index)
    const primaryAnchor = anchorByIndex.get(index)
    const angle: number = clusterAngle ?? primaryAngle ?? randRange(prng, 0, Math.PI * 2)
    const nearPr = primaryAnchor ? primaryAnchor.nearPr : clusterNearPr

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
  angle: number | null
  nearPr: NetworkRef | null
  /** Internal grouping key (the anchor hypha's own id), used only to detect a run of consecutive releases sharing the same real anchor -- never exposed on `Mushroom` itself. `null` when no real crossing hypha was found at all (a pure seeded-angle fallback, never grouped). */
  anchorKey: string | null
}

/** A hypha's own start/end disc radius (ignores tube thickness), from its already-grown points. */
function hyphaRadiusSpan(hypha: Hypha): { start: number; end: number } {
  return { start: discRadius(hypha.points[0]!.position), end: discRadius(hypha.points[hypha.points.length - 1]!.position) }
}

/** See `buildMushroomsOnRings`'s doc comment for the two-step (real link, then honest visual fallback) strategy. */
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
      const at = pointOnHyphaAtRadius(closestMergedBefore.points, ringRadius)
      return { angle: Math.atan2(at.position.z, at.position.x), nearPr: closestMergedBefore.ref, anchorKey: closestMergedBefore.id }
    }
  }

  let nearestCrossing: Hypha | null = null
  let nearestDelta = Number.POSITIVE_INFINITY
  for (const hypha of hyphae) {
    if (hypha.kind === 'main') continue
    const span = hyphaRadiusSpan(hypha)
    if (ringRadius < span.start - 1e-6 || ringRadius > span.end + 1e-6) continue
    const delta = Math.abs(hypha.time - releaseTime)
    if (delta < nearestDelta) {
      nearestDelta = delta
      nearestCrossing = hypha
    }
  }
  if (nearestCrossing) {
    const at = pointOnHyphaAtRadius(nearestCrossing.points, ringRadius)
    return { angle: Math.atan2(at.position.z, at.position.x), nearPr: null, anchorKey: nearestCrossing.id }
  }

  return { angle: null, nearPr: null, anchorKey: null }
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
