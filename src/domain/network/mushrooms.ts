import type { ReleaseInfo } from '../repo'
import { addVec3, vec3, type Vec3 } from '../tree/vector'
import { createPrng, randRange } from '../tree/prng'
import { pointOnHyphaAtTime } from './layout'
import type { HyphaPoint, Mushroom, NetworkRef } from './types'

/**
 * One mushroom per release, fruiting on the soil surface above its point on
 * the main hypha. Releases close in time cluster into a small group
 * (individual mushrooms, shared `clusterId`) instead of overlapping exactly.
 */

const MUSHROOM_LIFT = 0.16
const MUSHROOM_CLUSTER_GAP_MS = 1000 * 60 * 60 * 24 * 3 // releases within 3 days cluster together
const MUSHROOM_CLUSTER_SCATTER = 0.05
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

export function buildMushrooms(releases: ReleaseInfo[], mainPoints: HyphaPoint[], seed: string): Mushroom[] {
  if (releases.length === 0) return []

  const prng = createPrng(`${seed}:mushrooms`)
  const sorted = [...releases]
    .map((release) => ({ release, time: toEpochMs(release.date) }))
    .sort((a, b) => a.time - b.time)

  const seenMajors = new Set<number>()
  const mushrooms: Mushroom[] = []
  let clusterId: string | null = null
  let clusterAnchor: Vec3 | null = null
  let previousTime: number | null = null
  let clusterIndex = 0

  for (const { release, time } of sorted) {
    const semver = parseSemver(release.tag)
    const isFirstOfMajor = semver ? !seenMajors.has(semver.major) : false
    if (semver) seenMajors.add(semver.major)

    const isClustered = previousTime !== null && time - previousTime <= MUSHROOM_CLUSTER_GAP_MS
    if (!isClustered) {
      clusterIndex += 1
      clusterId = null
      clusterAnchor = null
    }
    previousTime = time

    const surfacePoint = pointOnHyphaAtTime(mainPoints, time)
    const anchor: Vec3 = clusterAnchor ?? addVec3(surfacePoint.position, vec3(0, MUSHROOM_LIFT, 0))
    const scatter = clusterAnchor
      ? vec3(randRange(prng, -MUSHROOM_CLUSTER_SCATTER, MUSHROOM_CLUSTER_SCATTER), 0, randRange(prng, -MUSHROOM_CLUSTER_SCATTER, MUSHROOM_CLUSTER_SCATTER))
      : vec3(0, 0, 0)

    if (isClustered && clusterId === null) {
      // The second member of a new cluster: retroactively tag the previous
      // (already-pushed) mushroom with a shared cluster id too.
      clusterId = `mushroom-cluster-${clusterIndex}`
      const prev = mushrooms[mushrooms.length - 1]
      if (prev) prev.clusterId = clusterId
      clusterAnchor = anchor
    } else if (!isClustered) {
      clusterAnchor = anchor
    }

    const ref: NetworkRef = { type: 'release', id: release.tag }
    mushrooms.push({
      id: `mushroom-${release.tag}`,
      kind: 'mushroom',
      time,
      ref,
      position: addVec3(anchor, scatter),
      scale: scaleForRelease(release, isFirstOfMajor),
      clusterId,
    })
  }

  return mushrooms
}
