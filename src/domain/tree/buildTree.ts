import { clamp, lerp, logScale } from '../math'
import type { MergedPullRequest, ReleaseInfo, RepoSnapshot } from '../repo'
import { type EraDraft, type EraOptions, DEFAULT_ERA_OPTIONS, buildEras } from './eras'
import { createPrng, randJitter, randRange, type Prng } from './prng'
import { computeTimeBounds } from './timeBounds'
import type {
  Bud,
  Flower,
  Fruit,
  Leaf,
  Limb,
  LimbPoint,
  SoilStratum,
  TimeBounds,
  TreeModel,
  TreeRef,
  Trunk,
  TrunkSegment,
  Twig,
} from './types'
import { addVec3, lerpVec3, polarToVec3, scaleVec3, vec3, type Vec3 } from './vector'

export interface BuildTreeOptions extends EraOptions {
  /** Merged PRs beyond this, per limb, become extra leaf density instead of twigs. */
  maxTwigsPerLimb: number
  /** Overflow (non-twig) leaves added per limb, capped. */
  maxOverflowLeavesPerLimb: number
  /** Open PRs + live branches shown as crown buds, capped combined. */
  maxBuds: number
}

export const DEFAULT_BUILD_TREE_OPTIONS: BuildTreeOptions = {
  ...DEFAULT_ERA_OPTIONS,
  maxTwigsPerLimb: 40,
  maxOverflowLeavesPerLimb: 30,
  maxBuds: 30,
}

const GOLDEN_ANGLE = 2.399963229728653 // radians (~137.5deg)
const MS_PER_DAY = 86_400_000
const REFERENCE_MAX_AGE_DAYS = 365 * 15 // 15 years, for log-scaling trunk height

const TRUNK_SEGMENTS = 12
const TRUNK_MIN_HEIGHT = 2.2
const TRUNK_MAX_HEIGHT = 9
const TRUNK_BASE_RADIUS = 0.42
const TRUNK_TOP_RADIUS = 0.1
const TRUNK_SWAY_STEP = 0.05

const LIMB_POINTS = 6
const LIMB_MIN_LENGTH = 0.7
const LIMB_MAX_LENGTH = 3.2
const LIMB_MIN_RADIUS = 0.035
const LIMB_MAX_RADIUS = 0.14
const LIMB_MIN_UPWARD_ANGLE = 0.28 // radians
const LIMB_MAX_UPWARD_ANGLE = 1.0
const LIMB_AZIMUTH_JITTER = 0.35
const LIMB_ANGLE_JITTER = 0.12
const LIMB_CURVE_JITTER = 0.12

const TWIG_POINTS = 3
const TWIG_MIN_LENGTH = 0.18
const TWIG_MAX_LENGTH = 0.4
const TWIG_BASE_RADIUS = 0.018

const LEAF_MIN_SCALE = 0.5
const LEAF_MAX_SCALE = 1.0
const LEAF_CLUSTER_RADIUS = 0.12
const LEAF_OLD_ERA_KEEP_PROBABILITY = 0.35
const LEAF_YOUNG_ERA_KEEP_PROBABILITY = 1.0

const FLOWER_SCALE = 0.16
const FRUIT_SCALE = 0.11
const BUD_SCALE = 0.09
const BUD_SCATTER_RADIUS = 0.5

function toEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

/** Maps a point in time to a trunk height, monotonically (older = lower). */
function timeToHeight(time: number, bounds: TimeBounds, trunkHeight: number): number {
  const span = bounds.lastEventTime - bounds.firstEventTime
  if (span <= 0) return trunkHeight * 0.5
  const t = clamp((time - bounds.firstEventTime) / span, 0, 1)
  return lerp(trunkHeight * 0.15, trunkHeight * 0.92, t)
}

/** 0 (fresh, at `lastEventTime`) -> 1 (autumn, at `firstEventTime`). */
function computeAge(time: number, bounds: TimeBounds): number {
  const span = bounds.lastEventTime - bounds.firstEventTime
  if (span <= 0) return 0.5
  const t = clamp((time - bounds.firstEventTime) / span, 0, 1)
  return clamp(1 - t, 0, 1)
}

function buildRepoRef(snapshot: RepoSnapshot): TreeRef {
  return { type: 'repo', id: `${snapshot.meta.owner}/${snapshot.meta.name}` }
}

function buildTrunk(snapshot: RepoSnapshot, bounds: TimeBounds, prng: Prng, repoRef: TreeRef): Trunk {
  const createdAt = toEpochMs(snapshot.meta.createdAt)
  const ageDays = Math.max(1, (bounds.lastEventTime - createdAt) / MS_PER_DAY)
  const heightNorm = logScale(ageDays, 1, REFERENCE_MAX_AGE_DAYS)
  const height = lerp(TRUNK_MIN_HEIGHT, TRUNK_MAX_HEIGHT, heightNorm)

  const segments: TrunkSegment[] = []
  let sway = vec3(0, 0, 0)
  for (let i = 0; i < TRUNK_SEGMENTS; i++) {
    const startT = i / TRUNK_SEGMENTS
    const endT = (i + 1) / TRUNK_SEGMENTS
    const startY = height * startT
    const endY = height * endT
    const start = addVec3(vec3(0, startY, 0), sway)
    sway = addVec3(sway, vec3(randJitter(prng, TRUNK_SWAY_STEP), 0, randJitter(prng, TRUNK_SWAY_STEP)))
    const end = addVec3(vec3(0, endY, 0), sway)

    const radiusStart = lerp(TRUNK_BASE_RADIUS, TRUNK_TOP_RADIUS, startT)
    const radiusEnd = lerp(TRUNK_BASE_RADIUS, TRUNK_TOP_RADIUS, endT)

    segments.push({
      id: `trunk-${i}`,
      kind: 'trunkSegment',
      time: lerp(createdAt, bounds.lastEventTime, startT),
      ref: repoRef,
      start,
      end,
      radiusStart,
      radiusEnd,
    })
  }

  return { segments, height, baseRadius: TRUNK_BASE_RADIUS }
}

function pointOnLimb(points: LimbPoint[], t: number): Vec3 {
  const clampedT = clamp(t, 0, 1)
  if (points.length === 1) return points[0]!.position
  const scaled = clampedT * (points.length - 1)
  const index = Math.min(points.length - 2, Math.floor(scaled))
  const localT = scaled - index
  return lerpVec3(points[index]!.position, points[index + 1]!.position, localT)
}

interface LimbBuild {
  limb: Limb
  era: EraDraft
  cappedPrs: MergedPullRequest[]
  overflowPrs: MergedPullRequest[]
  normalizedIndex: number
}

function buildLimb(
  era: EraDraft,
  index: number,
  eraCount: number,
  trunk: Trunk,
  bounds: TimeBounds,
  prng: Prng,
  ref: TreeRef,
  options: BuildTreeOptions,
): LimbBuild {
  const normalizedIndex = eraCount <= 1 ? 0.5 : index / (eraCount - 1)
  const emergenceHeight = timeToHeight(era.startTime, bounds, trunk.height)

  const activity = era.mergedPrs.length
  const activityNorm = logScale(activity, 0, Math.max(activity, options.maxTwigsPerLimb * 2))

  const azimuth = index * GOLDEN_ANGLE + randJitter(prng, LIMB_AZIMUTH_JITTER)
  const upwardAngle =
    lerp(LIMB_MIN_UPWARD_ANGLE, LIMB_MAX_UPWARD_ANGLE, normalizedIndex) + randJitter(prng, LIMB_ANGLE_JITTER)

  const length = lerp(LIMB_MIN_LENGTH, LIMB_MAX_LENGTH, activityNorm)
  const baseRadius =
    lerp(LIMB_MIN_RADIUS, LIMB_MAX_RADIUS, activityNorm) * lerp(1.35, 0.8, normalizedIndex)

  const basePosition = polarToVec3(azimuth, trunk.baseRadius * 0.4, emergenceHeight)
  const points: LimbPoint[] = []
  let curveOffset = vec3(0, 0, 0)
  for (let i = 0; i <= LIMB_POINTS; i++) {
    const t = i / LIMB_POINTS
    const forward = scaleVec3(
      vec3(Math.cos(azimuth) * Math.cos(upwardAngle), Math.sin(upwardAngle), Math.sin(azimuth) * Math.cos(upwardAngle)),
      length * t,
    )
    curveOffset = addVec3(curveOffset, vec3(randJitter(prng, LIMB_CURVE_JITTER * t), 0, randJitter(prng, LIMB_CURVE_JITTER * t)))
    const position = addVec3(addVec3(basePosition, forward), curveOffset)
    const radius = lerp(baseRadius, baseRadius * 0.22, t)
    points.push({ position, radius })
  }

  const sortedPrs = [...era.mergedPrs].sort((a, b) => toEpochMs(a.mergedAt) - toEpochMs(b.mergedAt))
  const cappedPrs = sortedPrs.slice(0, options.maxTwigsPerLimb)
  const overflowPrs = sortedPrs.slice(options.maxTwigsPerLimb)

  const limb: Limb = {
    id: `limb-${index}`,
    kind: 'limb',
    time: era.startTime,
    ref,
    eraIndex: index,
    points,
    activity,
    overflowPrCount: overflowPrs.length,
  }

  return { limb, era, cappedPrs, overflowPrs, normalizedIndex }
}

interface TwigBuild {
  twig: Twig
  fruit: Fruit
  leaves: Leaf[]
}

function buildTwig(
  pr: MergedPullRequest,
  index: number,
  total: number,
  limb: Limb,
  bounds: TimeBounds,
  prng: Prng,
  keepProbability: number,
): TwigBuild {
  const t = total <= 1 ? 0.5 : index / (total - 1)
  const side: -1 | 1 = index % 2 === 0 ? 1 : -1
  const base = pointOnLimb(limb.points, t)

  const twigLength = randRange(prng, TWIG_MIN_LENGTH, TWIG_MAX_LENGTH)
  const azimuth = randRange(prng, 0, Math.PI * 2)
  const tilt = randRange(prng, 0.3, 1.1)

  const points = []
  for (let i = 0; i <= TWIG_POINTS; i++) {
    const localT = i / TWIG_POINTS
    const offset = vec3(
      Math.cos(azimuth) * side * twigLength * localT,
      Math.sin(tilt) * twigLength * localT,
      Math.sin(azimuth) * side * twigLength * localT,
    )
    points.push({ position: addVec3(base, offset), radius: lerp(TWIG_BASE_RADIUS, TWIG_BASE_RADIUS * 0.3, localT) })
  }

  const ref: TreeRef = { type: 'pull_request', id: String(pr.number) }
  const time = toEpochMs(pr.mergedAt)
  const twig: Twig = {
    id: `twig-pr${pr.number}`,
    kind: 'twig',
    time,
    ref,
    limbId: limb.id,
    points,
    side,
  }

  const tip = points[points.length - 1]!.position
  const fruit: Fruit = {
    id: `fruit-pr${pr.number}`,
    kind: 'fruit',
    time,
    ref,
    position: tip,
    scale: FRUIT_SCALE * randRange(prng, 0.85, 1.15),
  }

  const leaves: Leaf[] = []
  pr.commits.forEach((commit, commitIndex) => {
    const alwaysKeep = commitIndex === 0
    if (!alwaysKeep && prng() > keepProbability) return

    const commitTime = toEpochMs(commit.authoredDate)
    const clusterOffset = vec3(
      randJitter(prng, LEAF_CLUSTER_RADIUS),
      randJitter(prng, LEAF_CLUSTER_RADIUS),
      randJitter(prng, LEAF_CLUSTER_RADIUS),
    )
    leaves.push({
      id: `leaf-pr${pr.number}-${commit.oid}`,
      kind: 'leaf',
      time: commitTime,
      ref: { type: 'commit', id: commit.oid },
      position: addVec3(tip, clusterOffset),
      rotation: randRange(prng, 0, Math.PI * 2),
      scale: randRange(prng, LEAF_MIN_SCALE, LEAF_MAX_SCALE),
      age: computeAge(commitTime, bounds),
      twigId: twig.id,
      limbId: limb.id,
    })
  })

  return { twig, fruit, leaves }
}

function buildOverflowLeaves(
  overflowPrs: MergedPullRequest[],
  limb: Limb,
  bounds: TimeBounds,
  prng: Prng,
  keepProbability: number,
  cap: number,
): Leaf[] {
  const leaves: Leaf[] = []
  for (const pr of overflowPrs.slice(0, cap)) {
    if (prng() > keepProbability) continue
    const commit = pr.commits[0]
    const t = randRange(prng, 0, 1)
    const base = pointOnLimb(limb.points, t)
    const scatter = vec3(
      randJitter(prng, LEAF_CLUSTER_RADIUS * 1.5),
      randJitter(prng, LEAF_CLUSTER_RADIUS * 1.5),
      randJitter(prng, LEAF_CLUSTER_RADIUS * 1.5),
    )
    const time = commit ? toEpochMs(commit.authoredDate) : toEpochMs(pr.mergedAt)
    leaves.push({
      id: `leaf-overflow-pr${pr.number}`,
      kind: 'leaf',
      time,
      ref: commit ? { type: 'commit', id: commit.oid } : { type: 'pull_request', id: String(pr.number) },
      position: addVec3(base, scatter),
      rotation: randRange(prng, 0, Math.PI * 2),
      scale: randRange(prng, LEAF_MIN_SCALE, LEAF_MAX_SCALE) * 0.8,
      age: computeAge(time, bounds),
      twigId: null,
      limbId: limb.id,
    })
  }
  return leaves
}

function buildFlowers(snapshot: RepoSnapshot, limbs: Limb[], eras: EraDraft[]): Flower[] {
  if (limbs.length === 0) return []

  const findEraIndexForTime = (time: number): number => {
    if (time <= eras[0]!.startTime) return 0
    for (let i = 0; i < eras.length; i++) {
      if (time < eras[i]!.endTime) return i
    }
    return eras.length - 1
  }

  return snapshot.releases.map((release) => {
    const time = toEpochMs(release.date)
    const limb = limbs[findEraIndexForTime(time)]!
    return {
      id: `flower-${release.tag}`,
      kind: 'flower' as const,
      time,
      ref: { type: 'release' as const, id: release.tag },
      position: limb.points[0]!.position,
      scale: FLOWER_SCALE,
      limbId: limb.id,
    }
  })
}

function buildBuds(snapshot: RepoSnapshot, trunk: Trunk, prng: Prng, maxBuds: number): Bud[] {
  const perSourceCap = Math.max(1, Math.floor(maxBuds / 2))
  const crown = vec3(0, trunk.height, 0)
  const buds: Bud[] = []

  for (const pr of snapshot.openPullRequests.slice(0, perSourceCap)) {
    const azimuth = randRange(prng, 0, Math.PI * 2)
    const radius = randRange(prng, 0.05, BUD_SCATTER_RADIUS)
    buds.push({
      id: `bud-pr${pr.number}`,
      kind: 'bud',
      time: toEpochMs(pr.createdAt),
      ref: { type: 'pull_request', id: String(pr.number) },
      position: addVec3(crown, polarToVec3(azimuth, radius, randRange(prng, 0, 0.4))),
      scale: BUD_SCALE * randRange(prng, 0.85, 1.15),
      source: 'open_pull_request',
    })
  }

  const featureBranches = snapshot.liveBranches.filter((branch) => branch.name !== snapshot.meta.defaultBranch)
  for (const branch of featureBranches.slice(0, perSourceCap)) {
    const azimuth = randRange(prng, 0, Math.PI * 2)
    const radius = randRange(prng, 0.05, BUD_SCATTER_RADIUS)
    buds.push({
      id: `bud-branch-${branch.name}`,
      kind: 'bud',
      time: toEpochMs(branch.lastCommitDate),
      ref: { type: 'branch', id: branch.name },
      position: addVec3(crown, polarToVec3(azimuth, radius, randRange(prng, 0, 0.4))),
      scale: BUD_SCALE * randRange(prng, 0.85, 1.15),
      source: 'live_branch',
    })
  }

  return buds.slice(0, maxBuds)
}

function buildSoil(snapshot: RepoSnapshot, createdAtMs: number): SoilStratum[] {
  const languages = snapshot.languages.filter((language) => language.bytes > 0)
  const totalBytes = languages.reduce((sum, language) => sum + language.bytes, 0)

  if (totalBytes <= 0) {
    return [
      {
        id: 'soil-unknown',
        kind: 'soilStratum',
        time: createdAtMs,
        ref: { type: 'language', id: 'unknown' },
        share: 1,
        offset: 0,
        color: null,
      },
    ]
  }

  let offset = 0
  return languages.map((language) => {
    const share = language.bytes / totalBytes
    const stratum: SoilStratum = {
      id: `soil-${language.name}`,
      kind: 'soilStratum',
      time: createdAtMs,
      ref: { type: 'language', id: language.name },
      share,
      offset,
      color: language.color,
    }
    offset += share
    return stratum
  })
}

/**
 * Builds a deterministic `TreeModel` from a repository snapshot: the same
 * snapshot (and options) always produces an identical model, seeded from
 * `owner/repo`. Pure -- no React, no three.js.
 */
export function buildTree(snapshot: RepoSnapshot, options: Partial<BuildTreeOptions> = {}): TreeModel {
  const resolvedOptions: BuildTreeOptions = { ...DEFAULT_BUILD_TREE_OPTIONS, ...options }
  const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
  const prng = createPrng(seed)
  const bounds = computeTimeBounds(snapshot)
  const repoRef = buildRepoRef(snapshot)

  const trunk = buildTrunk(snapshot, bounds, prng, repoRef)
  const eras = buildEras(snapshot, bounds, resolvedOptions)

  const releaseTimeMap = new Map<number, ReleaseInfo>()
  for (const release of snapshot.releases) {
    const t = toEpochMs(release.date)
    if (Number.isFinite(t)) releaseTimeMap.set(t, release)
  }

  const limbs: Limb[] = []
  const twigs: Twig[] = []
  const fruits: Fruit[] = []
  const leaves: Leaf[] = []

  eras.forEach((era, index) => {
    const matchingRelease = releaseTimeMap.get(era.startTime)
    const ref: TreeRef = matchingRelease
      ? { type: 'release', id: matchingRelease.tag }
      : { type: 'era', id: `era-${index}` }

    const { limb, cappedPrs, overflowPrs, normalizedIndex } = buildLimb(
      era,
      index,
      eras.length,
      trunk,
      bounds,
      prng,
      ref,
      resolvedOptions,
    )
    limbs.push(limb)

    const keepProbability = lerp(LEAF_OLD_ERA_KEEP_PROBABILITY, LEAF_YOUNG_ERA_KEEP_PROBABILITY, normalizedIndex)

    cappedPrs.forEach((pr, prIndex) => {
      const { twig, fruit, leaves: prLeaves } = buildTwig(
        pr,
        prIndex,
        cappedPrs.length,
        limb,
        bounds,
        prng,
        keepProbability,
      )
      twigs.push(twig)
      fruits.push(fruit)
      leaves.push(...prLeaves)
    })

    leaves.push(
      ...buildOverflowLeaves(overflowPrs, limb, bounds, prng, keepProbability, resolvedOptions.maxOverflowLeavesPerLimb),
    )
  })

  const flowers = buildFlowers(snapshot, limbs, eras)
  const buds = buildBuds(snapshot, trunk, prng, resolvedOptions.maxBuds)
  const soil = buildSoil(snapshot, toEpochMs(snapshot.meta.createdAt))

  return { seed, bounds, trunk, limbs, twigs, fruits, leaves, flowers, buds, soil }
}
