import { describe, expect, it } from 'vitest'
import type { Hypha } from './types'
import {
  buildMushroomsOnRings,
  computeReleaseSequence,
  enforceMinAngularSeparation,
  layoutBurstRing,
  mushroomCapWorldRadius,
  MUSHROOM_GOLDEN_ANGLE_RADIANS,
  MUSHROOM_MIN_ANGULAR_SEPARATION,
  MUSHROOM_RADIUS_SEPARATION_WINDOW,
} from './mushrooms'

function release(tag: string, date: string, name: string | null = null) {
  return { name: name ?? tag, tag, date, url: `https://x/${tag}`, targetOid: null }
}

describe('computeReleaseSequence', () => {
  it('gives a bigger scale to a major release than a patch release', () => {
    const releases = [release('v2.0.0', new Date(0).toISOString()), release('v2.0.1', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const sequence = computeReleaseSequence(releases)
    const major = sequence.find((entry) => entry.release.tag === 'v2.0.0')!
    const patch = sequence.find((entry) => entry.release.tag === 'v2.0.1')!
    expect(major.scale).toBeGreaterThan(patch.scale)
  })

  it('never produces a NaN/Infinity scale, even for a non-semver tag', () => {
    const releases = [release('nightly-build', new Date(0).toISOString())]
    expect(Number.isFinite(computeReleaseSequence(releases)[0]!.scale)).toBe(true)
  })

  it('clusters releases close in time under a shared cluster index, and leaves distant ones standalone', () => {
    const releases = [
      release('v1.0.0', new Date(0).toISOString()),
      release('v1.0.1', new Date(1000 * 60 * 60).toISOString()), // 1 hour later: clustered
      release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString()), // ~400 days later: standalone
    ]
    const sequence = computeReleaseSequence(releases)
    expect(sequence[1]!.isClustered).toBe(true)
    expect(sequence[1]!.clusterIndex).toBe(sequence[0]!.clusterIndex)
    expect(sequence[2]!.isClustered).toBe(false)
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

  it('spreads a run of releases that all resolve to the same anchor hypha across the disc (golden angle), not one straight line', () => {
    // A long-lived merged PR (its own curve spans disc radius 1..30, far past
    // any of these releases' ring radii) with no OTHER merge in between --
    // every release below honestly resolves `nearPr` to the same PR. Before
    // M3c this drove PLACEMENT too (`Math.atan2` of a point on that one
    // hypha's own curve for every single one), visually reading as "all these
    // mushrooms sit on one exact line/arc" (a real bug found via 3D visual
    // review, M3/M3c). `nearPr` is still the same real PR for every one of
    // them; only the angle is now independent of it.
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
    // ...but their angles are spread across (most of) the whole disc, not bunched into a narrow arc.
    const angles = mushrooms.map((m) => Math.atan2(m.position.z, m.position.x))
    const uniqueAngles = new Set(angles.map((a) => a.toFixed(4)))
    expect(uniqueAngles.size).toBe(mushrooms.length)
    const angleSpread = Math.max(...angles) - Math.min(...angles)
    expect(angleSpread).toBeGreaterThan(2.0)
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

  it('spreads many releases across the whole disc via the golden angle, not just a narrow arc (M3c item 1)', () => {
    // 80 releases, all resolving to the same single early anchor (mirrors the
    // real valtio-fixture finding: a bursty early-growth chain gives
    // `findRingAnchor` the same nearPr for a long run) -- every one of them
    // must still land at a genuinely different angle, and collectively cover
    // most of the circle rather than one arm's worth.
    const longLivedPr = mergedHypha({
      points: [
        { position: { x: 1, y: 0, z: 0 }, radius: 0.02, time: 0 },
        { position: { x: 30, y: 0, z: 0 }, radius: 0.01, time: 1000 * 60 * 60 * 24 * 4000 },
      ],
    })
    const releases = Array.from({ length: 80 }, (_, i) => release(`v1.${i}.0`, new Date(1000 * 60 * 60 * 24 * (10 + i * 7)).toISOString()))
    const mushrooms = buildMushroomsOnRings(releases, FLAT_RADIUS_FOR_TIME, [longLivedPr], 'o/r')

    const angles = mushrooms.map((m) => normalizeTestAngle(Math.atan2(m.position.z, m.position.x)))
    // Bucket the circle into 8 45-degree sectors -- a real spread should
    // touch most of them, not concentrate in one or two.
    const sectors = new Set(angles.map((a) => Math.floor((a / (Math.PI * 2)) * 8)))
    expect(sectors.size).toBeGreaterThanOrEqual(6)
  })

  it('keeps a minimum angular gap between mushrooms whose rings land at a similar radius', () => {
    // 60-day gaps (well above the 3-day cluster threshold, so every release
    // stays standalone) -> a ~0.06 world-unit ring-radius step under
    // `FLAT_RADIUS_FOR_TIME`, so at most a handful of releases ever share
    // one `MUSHROOM_RADIUS_SEPARATION_WINDOW` (0.2) band at a time -- a
    // realistic density (a real repo's ~80-100 releases spread across disc
    // radius 0..5 average a similar step). A far denser packing than a real
    // repo ever produces can still mathematically fail to fit every pair at
    // the full minimum separation (more points than `2*PI/minSeparation`
    // ever allows in one shared band), which is a real geometry limit, not a
    // bug in the spacing algorithm.
    const releases = Array.from({ length: 40 }, (_, i) => release(`v1.${i}.0`, new Date(1000 * 60 * 60 * 24 * (10 + i * 60)).toISOString()))
    const mushrooms = buildMushroomsOnRings(releases, FLAT_RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')

    const entries = mushrooms.map((m) => ({
      radius: Math.hypot(m.position.x, m.position.z),
      angle: Math.atan2(m.position.z, m.position.x),
    }))
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (Math.abs(entries[i]!.radius - entries[j]!.radius) > MUSHROOM_RADIUS_SEPARATION_WINDOW) continue
        let delta = Math.abs(entries[i]!.angle - entries[j]!.angle) % (Math.PI * 2)
        if (delta > Math.PI) delta = Math.PI * 2 - delta
        expect(delta).toBeGreaterThanOrEqual(MUSHROOM_MIN_ANGULAR_SEPARATION - 1e-6)
      }
    }
  })
})

function normalizeTestAngle(angle: number): number {
  const twoPi = Math.PI * 2
  return ((angle % twoPi) + twoPi) % twoPi
}

describe('enforceMinAngularSeparation', () => {
  it('leaves already-separated angles untouched', () => {
    const entries = [
      { radius: 1, angle: 0 },
      { radius: 1, angle: Math.PI },
    ]
    expect(enforceMinAngularSeparation(entries, 0.3, 0.2)).toEqual([0, Math.PI])
  })

  it('pushes a too-close neighbor apart when radii are within the proximity window', () => {
    const entries = [
      { radius: 1, angle: 0 },
      { radius: 1.05, angle: 0.05 },
    ]
    const result = enforceMinAngularSeparation(entries, 0.3, 0.2)
    expect(result[0]).toBe(0)
    expect(Math.abs(result[1]! - result[0]!)).toBeCloseTo(0.3, 6)
  })

  it('never adjusts entries whose radii are far apart, however close their angle', () => {
    const entries = [
      { radius: 1, angle: 0 },
      { radius: 5, angle: 0.001 },
    ]
    expect(enforceMinAngularSeparation(entries, 0.3, 0.2)).toEqual([0, 0.001])
  })

  it('is deterministic and order-independent by radius', () => {
    const entries = [
      { radius: 2, angle: 0.1 },
      { radius: 1, angle: 0.0 },
      { radius: 1.02, angle: 0.05 },
    ]
    const a = enforceMinAngularSeparation(entries, 0.3, 0.2)
    const b = enforceMinAngularSeparation(entries, 0.3, 0.2)
    expect(a).toEqual(b)
  })
})

describe('MUSHROOM_GOLDEN_ANGLE_RADIANS', () => {
  it('is the golden angle (~137.5deg), not a round fraction of the circle', () => {
    expect(MUSHROOM_GOLDEN_ANGLE_RADIANS).toBeCloseTo(2.399963229728653, 9)
  })
})

describe('layoutBurstRing (final polish pass, Unit 2: "fairy rings")', () => {
  it('returns a single zero offset for one member -- singles stay single', () => {
    expect(layoutBurstRing([1])).toEqual([{ dx: 0, dz: 0 }])
  })

  it('returns [] for zero members', () => {
    expect(layoutBurstRing([])).toEqual([])
  })

  it('is deterministic: same scales in the same order always produce the same ring', () => {
    const scales = [0.55, 0.75, 1.05, 0.7, 0.55]
    expect(layoutBurstRing(scales)).toEqual(layoutBurstRing(scales))
  })

  it('spaces every member evenly around the ring (equal angular gaps)', () => {
    const offsets = layoutBurstRing([0.55, 0.75, 1.05, 0.7, 0.6, 0.55])
    const angles = offsets.map((o) => Math.atan2(o.dz, o.dx))
    const n = angles.length
    for (let i = 0; i < n; i++) {
      const a = angles[i]!
      const b = angles[(i + 1) % n]!
      let gap = b - a
      if (gap <= 0) gap += Math.PI * 2
      expect(gap).toBeCloseTo((Math.PI * 2) / n, 6)
    }
  })

  it('places every member at the same distance from the shared center (a true ring, not an ellipse/spiral)', () => {
    const offsets = layoutBurstRing([0.55, 1.05, 0.7, 0.55, 0.75])
    const radii = offsets.map((o) => Math.hypot(o.dx, o.dz))
    for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 9)
  })

  it('never overlaps two members\' own rendered caps, for a wide range of burst sizes and cap scales', () => {
    for (const n of [2, 3, 5, 8, 16, 24]) {
      // A real repo's own scale set: patch (0.55) most common, a few minor
      // (0.75) and major (1.05) -- deterministic per test run, not random.
      const scales = Array.from({ length: n }, (_, i) => [0.55, 0.75, 1.05, 0.7][i % 4]!)
      const offsets = layoutBurstRing(scales)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = offsets[i]!.dx - offsets[j]!.dx
          const dz = offsets[i]!.dz - offsets[j]!.dz
          const distance = Math.hypot(dx, dz)
          const minDistance = mushroomCapWorldRadius(scales[i]!) + mushroomCapWorldRadius(scales[j]!)
          expect(distance).toBeGreaterThanOrEqual(minDistance - 1e-9)
        }
      }
    }
  })

  it('a burst of identically-sized (all-major) caps still never overlaps -- the worst-case density', () => {
    const scales = Array.from({ length: 16 }, () => 1.05)
    const offsets = layoutBurstRing(scales)
    for (let i = 0; i < offsets.length; i++) {
      for (let j = i + 1; j < offsets.length; j++) {
        const distance = Math.hypot(offsets[i]!.dx - offsets[j]!.dx, offsets[i]!.dz - offsets[j]!.dz)
        expect(distance).toBeGreaterThanOrEqual(2 * mushroomCapWorldRadius(1.05) - 1e-9)
      }
    }
  })
})

describe('buildMushroomsOnRings burst layout (final polish pass, Unit 2)', () => {
  const RADIUS_FOR_TIME = (time: number): number => 1 + time / 10000
  const NO_HYPHAE: Hypha[] = []
  const DAY_MS = 1000 * 60 * 60 * 24

  it('detects a burst of many releases close in time (item 1: "detect bursts") and gives them all one shared clusterId', () => {
    // express's own real-world motivating case: ~16 releases within a short window.
    const releases = Array.from({ length: 16 }, (_, i) => release(`v1.0.${i}`, new Date(i * 60 * 60 * 1000).toISOString())) // 1 hour apart
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    expect(mushrooms).toHaveLength(16)
    const clusterIds = new Set(mushrooms.map((m) => m.clusterId))
    expect(clusterIds.size).toBe(1)
    expect(mushrooms.every((m) => m.clusterId !== null)).toBe(true)
  })

  it('lays a burst out as an evenly-spaced ring around the group\'s own shared center, not a straight line/pile', () => {
    const releases = Array.from({ length: 16 }, (_, i) => release(`v1.0.${i}`, new Date(i * 60 * 60 * 1000).toISOString()))
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    const centerTime = releases.reduce((sum, r) => sum + Date.parse(r.date), 0) / releases.length
    const centerRadius = RADIUS_FOR_TIME(centerTime)
    // The ring's own radius is exactly whatever `layoutBurstRing` computes
    // for these 16 members' own cap scales (it grows with member count/cap
    // size so caps never overlap, see that function's dedicated tests) --
    // every member's DISTANCE FROM THE GROUP'S SHARED RADIUS must be exactly
    // that, not scattered across the disc's own much bigger radial span.
    const scales = computeReleaseSequence(releases).map((entry) => entry.scale)
    const ringOffsets = layoutBurstRing(scales)
    const expectedRingRadius = Math.hypot(ringOffsets[0]!.dx, ringOffsets[0]!.dz)
    const distancesFromGroupRadius = mushrooms.map((m) => Math.abs(Math.hypot(m.position.x, m.position.z) - centerRadius))
    for (const d of distancesFromGroupRadius) expect(d).toBeLessThanOrEqual(expectedRingRadius + 1e-6)
    // ...and at least one member should sit meaningfully away from dead
    // center (i.e. the ring isn't degenerate) -- proves radius is anchored
    // to the GROUP center plus a real ring offset, not per-member.
    expect(Math.max(...distancesFromGroupRadius)).toBeGreaterThan(0.01)

    // Not literally collinear either -- a genuine 2D spread of positions, not one line.
    const xs = mushrooms.map((m) => m.position.x)
    const zs = mushrooms.map((m) => m.position.z)
    const uniqueX = new Set(xs.map((x) => x.toFixed(5))).size
    const uniqueZ = new Set(zs.map((z) => z.toFixed(5))).size
    expect(uniqueX).toBeGreaterThan(1)
    expect(uniqueZ).toBeGreaterThan(1)
  })

  it('no two mushroom caps in a burst overlap (min distance, item "no overlap between mushroom caps")', () => {
    const releases = Array.from({ length: 16 }, (_, i) => {
      // A believable real mix: mostly patches, one minor, one major.
      const tag = i === 0 ? `v${i + 1}.0.0` : i === 8 ? `v${i}.1.0` : `v1.0.${i}`
      return release(tag, new Date(i * 60 * 60 * 1000).toISOString())
    })
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    for (let i = 0; i < mushrooms.length; i++) {
      for (let j = i + 1; j < mushrooms.length; j++) {
        const a = mushrooms[i]!
        const b = mushrooms[j]!
        if (a.clusterId === null || a.clusterId !== b.clusterId) continue
        const distance = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)
        const minDistance = mushroomCapWorldRadius(a.scale) + mushroomCapWorldRadius(b.scale)
        expect(distance).toBeGreaterThanOrEqual(minDistance - 1e-9)
      }
    }
  })

  it('is deterministic for the same seed, including burst ring layout', () => {
    const releases = Array.from({ length: 16 }, (_, i) => release(`v1.0.${i}`, new Date(i * 60 * 60 * 1000).toISOString()))
    const a = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    const b = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    expect(a).toEqual(b)
  })

  it('a single, far-apart release never gets a clusterId ("singles stay single")', () => {
    const releases = [release('v1.0.0', new Date(0).toISOString()), release('v2.0.0', new Date(400 * DAY_MS).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    expect(mushrooms.every((m) => m.clusterId === null)).toBe(true)
  })

  it('each burst member still carries its own real release data (individually pickable)', () => {
    const releases = Array.from({ length: 5 }, (_, i) => release(`v1.0.${i}`, new Date(i * 60 * 60 * 1000).toISOString()))
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    const tags = new Set(mushrooms.map((m) => m.ref.id))
    expect(tags.size).toBe(5)
    for (const r of releases) expect(tags.has(r.tag)).toBe(true)
  })

  it('never produces NaN/Infinity for a large burst', () => {
    const releases = Array.from({ length: 20 }, (_, i) => release(`v1.0.${i}`, new Date(i * 60 * 60 * 1000).toISOString()))
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, NO_HYPHAE, 'o/r')
    for (const m of mushrooms) {
      expect(Number.isFinite(m.position.x)).toBe(true)
      expect(Number.isFinite(m.position.y)).toBe(true)
      expect(Number.isFinite(m.position.z)).toBe(true)
    }
  })
})
