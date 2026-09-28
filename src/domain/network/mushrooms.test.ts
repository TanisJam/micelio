import { describe, expect, it } from 'vitest'
import type { Hypha, HyphaPoint } from './types'
import { buildMushrooms, buildMushroomsOnRings } from './mushrooms'

const MAIN_POINTS: HyphaPoint[] = [
  { position: { x: 0, y: 0, z: 0 }, radius: 0.1, time: 0 },
  { position: { x: 5, y: 0, z: 0 }, radius: 0.03, time: 1000 },
]

function release(tag: string, date: string, name: string | null = null) {
  return { name: name ?? tag, tag, date, url: `https://x/${tag}`, targetOid: null }
}

describe('buildMushrooms', () => {
  it('returns [] for no releases', () => {
    expect(buildMushrooms([], MAIN_POINTS, 'o/r')).toEqual([])
  })

  it('one mushroom per release, each with a real ref and a lifted position', () => {
    const releases = [release('v1.0.0', new Date(500).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    expect(mushrooms).toHaveLength(1)
    expect(mushrooms[0]!.ref).toEqual({ type: 'release', id: 'v1.0.0' })
    expect(mushrooms[0]!.position.y).toBeGreaterThan(0)
  })

  it('is deterministic for the same seed', () => {
    const releases = [release('v1.0.0', new Date(200).toISOString()), release('v1.0.1', new Date(210).toISOString())]
    expect(buildMushrooms(releases, MAIN_POINTS, 'o/r')).toEqual(buildMushrooms(releases, MAIN_POINTS, 'o/r'))
  })

  it('clusters releases close in time under a shared clusterId, and leaves distant ones standalone', () => {
    const closeTogether = [
      release('v1.0.0', new Date(0).toISOString()),
      release('v1.0.1', new Date(1000 * 60 * 60).toISOString()), // 1 hour later: clustered
    ]
    const farApart = [release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())] // ~400 days later: standalone
    const mushrooms = buildMushrooms([...closeTogether, ...farApart], MAIN_POINTS, 'o/r')

    const clustered = mushrooms.filter((m) => m.ref.id === 'v1.0.0' || m.ref.id === 'v1.0.1')
    expect(clustered[0]!.clusterId).not.toBeNull()
    expect(clustered[0]!.clusterId).toBe(clustered[1]!.clusterId)

    const standalone = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    expect(standalone.clusterId).toBeNull()
  })

  it('gives a bigger scale to a major release than a patch release', () => {
    const releases = [release('v2.0.0', new Date(0).toISOString()), release('v2.0.1', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    const major = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    const patch = mushrooms.find((m) => m.ref.id === 'v2.0.1')!
    expect(major.scale).toBeGreaterThan(patch.scale)
  })

  it('never produces NaN/Infinity, even for a non-semver tag', () => {
    const releases = [release('nightly-build', new Date(0).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    expect(Number.isFinite(mushrooms[0]!.scale)).toBe(true)
    expect(Number.isFinite(mushrooms[0]!.position.x)).toBe(true)
  })
})

describe('buildMushroomsOnRings (colony layout)', () => {
  const RADIUS_FOR_TIME = (time: number): number => 1 + time / 10000
  const NO_HYPHAE: Hypha[] = []

  function mergedHypha(overrides: Partial<Hypha> = {}): Hypha {
    return {
      id: 'hypha-pr1',
      kind: 'merged',
      ref: { type: 'pull_request', id: '1' },
      time: 0,
      parentHyphaId: 'hypha-main',
      splitTime: 0,
      endTime: 100,
      status: 'fused',
      points: [
        { position: { x: 1, y: 0, z: 0 }, radius: 0.02, time: 0 },
        { position: { x: 2, y: 0, z: 0 }, radius: 0.01, time: 100 },
      ],
      lane: 0,
      side: 0,
      commitCount: 1,
      attachment: 'colony',
      ...overrides,
    }
  }

  it('returns [] for no releases', () => {
    expect(buildMushroomsOnRings([], RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')).toEqual([])
  })

  it('places each mushroom exactly at radiusForTime(its own release date)', () => {
    const releases = [release('v1.0.0', new Date(500).toISOString()), release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    for (const mushroom of mushrooms) {
      const radius = Math.hypot(mushroom.position.x, mushroom.position.z)
      expect(radius).toBeCloseTo(RADIUS_FOR_TIME(mushroom.time), 6)
    }
  })

  it('is deterministic for the same seed', () => {
    const releases = [release('v1.0.0', new Date(200).toISOString()), release('v1.0.1', new Date(210).toISOString())]
    expect(buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')).toEqual(buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r'))
  })

  it('clusters releases close in time under a shared clusterId, and leaves distant ones standalone', () => {
    const closeTogether = [release('v1.0.0', new Date(0).toISOString()), release('v1.0.1', new Date(1000 * 60 * 60).toISOString())]
    const farApart = [release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushroomsOnRings([...closeTogether, ...farApart], RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    const clustered = mushrooms.filter((m) => m.ref.id === 'v1.0.0' || m.ref.id === 'v1.0.1')
    expect(clustered[0]!.clusterId).not.toBeNull()
    expect(clustered[0]!.clusterId).toBe(clustered[1]!.clusterId)
    const standalone = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    expect(standalone.clusterId).toBeNull()
  })

  it('never produces NaN/Infinity', () => {
    const releases = [release('nightly-build', new Date(0).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    expect(Number.isFinite(mushrooms[0]!.position.x)).toBe(true)
    expect(Number.isFinite(mushrooms[0]!.position.z)).toBe(true)
  })

  it('links a mushroom to the merged PR closest before the release, when that hypha\'s own curve reaches the ring', () => {
    // radiusForTime(release) = 1 + 500/10000 = 1.05, which lies within the
    // stub hypha's [1, 2] disc-radius span -- a genuine "intersection".
    const releases = [release('v1.0.0', new Date(500).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, [mergedHypha()], 'o/r')
    expect(mushrooms[0]!.nearPr).toEqual({ type: 'pull_request', id: '1' })
    const radius = Math.hypot(mushrooms[0]!.position.x, mushrooms[0]!.position.z)
    expect(radius).toBeCloseTo(RADIUS_FOR_TIME(500), 6)
  })

  it('leaves nearPr null when no merged hypha reaches the ring (honest visual-only fallback)', () => {
    const releases = [release('v1.0.0', new Date(500).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    expect(mushrooms[0]!.nearPr).toBeNull()
  })

  // A flat radius/time slope (unlike the outer `RADIUS_FOR_TIME`, tuned for
  // millisecond-scale test dates) so multi-month gaps between releases --
  // required to keep them un-clustered (> `MUSHROOM_CLUSTER_GAP_MS`, 3 days)
  // -- still land within one long-lived hypha's own disc-radius span.
  const FLAT_RADIUS_FOR_TIME = (time: number): number => 1 + time / (1000 * 60 * 60 * 24 * 1000)

  it('spreads a run of releases that all resolve to the same anchor hypha across distinct angles instead of one straight line', () => {
    // A long-lived merged PR (its own curve spans disc radius 1..30, far past
    // any of these releases' ring radii) with no OTHER merge in between --
    // every release below honestly resolves `nearPr` to the same PR, which
    // previously meant `Math.atan2` of a point on that one hypha's own curve
    // for every single one, visually reading as "all these mushrooms sit on
    // one exact line" (a real bug found via 3D visual review, M3).
    const longLivedPr = mergedHypha({
      points: [
        { position: { x: 1, y: 0, z: 0 }, radius: 0.02, time: 0 },
        { position: { x: 30, y: 0, z: 0 }, radius: 0.01, time: 1000 * 60 * 60 * 24 * 900 },
      ],
    })
    const releases = [
      release('v1.0.0', new Date(1000 * 60 * 60 * 24 * 10).toISOString()),
      release('v1.1.0', new Date(1000 * 60 * 60 * 24 * 60).toISOString()), // 50 days later: not clustered
      release('v1.2.0', new Date(1000 * 60 * 60 * 24 * 120).toISOString()), // another 60 days later: not clustered
      release('v1.3.0', new Date(1000 * 60 * 60 * 24 * 180).toISOString()),
    ]
    const mushrooms = buildMushroomsOnRings(releases, FLAT_RADIUS_FOR_TIME, [longLivedPr], 'o/r')

    // Every release still honestly links to the same real PR...
    for (const mushroom of mushrooms) expect(mushroom.nearPr).toEqual({ type: 'pull_request', id: '1' })
    // ...but their angles are no longer all identical (spread across the run).
    const angles = mushrooms.map((m) => Math.atan2(m.position.z, m.position.x))
    const uniqueAngles = new Set(angles.map((a) => a.toFixed(4)))
    expect(uniqueAngles.size).toBe(mushrooms.length)
    // Still bounded -- a reasonable "fruiting near its real anchor" spread, not scattered randomly far away.
    const angleSpread = Math.max(...angles) - Math.min(...angles)
    expect(angleSpread).toBeLessThan(1.2)
  })

  it('is deterministic for a repeated-anchor run (same seed -> same spread)', () => {
    const longLivedPr = mergedHypha({
      points: [
        { position: { x: 1, y: 0, z: 0 }, radius: 0.02, time: 0 },
        { position: { x: 30, y: 0, z: 0 }, radius: 0.01, time: 1000 * 60 * 60 * 24 * 900 },
      ],
    })
    const releases = [
      release('v1.0.0', new Date(1000 * 60 * 60 * 24 * 10).toISOString()),
      release('v1.1.0', new Date(1000 * 60 * 60 * 24 * 60).toISOString()),
      release('v1.2.0', new Date(1000 * 60 * 60 * 24 * 120).toISOString()),
    ]
    const a = buildMushroomsOnRings(releases, FLAT_RADIUS_FOR_TIME, [longLivedPr], 'o/r')
    const b = buildMushroomsOnRings(releases, FLAT_RADIUS_FOR_TIME, [longLivedPr], 'o/r')
    expect(a).toEqual(b)
  })
})
