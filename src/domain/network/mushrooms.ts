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

  const mushrooms: Mushroom[] = []
  let clusterId: string | null = null
  let clusterAngle: number | null = null

  for (const entry of sequence) {
    if (!entry.isClustered) clusterId = null

    const radius = radiusForTime(entry.time)
    const anchor = findRingAnchor(hyphae, entry.time, radius)
    const angle: number = clusterAngle ?? anchor.angle ?? randRange(prng, 0, Math.PI * 2)

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
    } else if (!entry.isClustered) {
      clusterAngle = angle
    }

    mushrooms.push(makeMushroom(entry, position, clusterId, anchor.nearPr))
  }

  return mushrooms
}

interface RingAnchor {
  angle: number | null
  nearPr: NetworkRef | null
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
      return { angle: Math.atan2(at.position.z, at.position.x), nearPr: closestMergedBefore.ref }
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
    return { angle: Math.atan2(at.position.z, at.position.x), nearPr: null }
  }

  return { angle: null, nearPr: null }
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
