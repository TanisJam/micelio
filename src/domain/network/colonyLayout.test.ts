import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../shared/timeBounds'
import { subVec3, vec3Length } from '../shared/vector'
import { makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import {
  applySwirl,
  applySwirlToPosition,
  COLONY_CLOSED_LENGTH_MULTIPLIER,
  COLONY_LENGTH_MAX,
  COLONY_LENGTH_MIN,
  computeWorkLength,
  layoutNetworkColony,
  swirlAngleForRadius,
  unswirlPosition,
  WIDTH_TO_LENGTH_CAP_FRACTION,
} from './colonyLayout'
import { DEFAULT_LAYOUT_OPTIONS, discRadius, DISC_MAX_RADIUS, pointOnHyphaAtRadius } from './ringGeometry'
import { buildHyphaTopology } from './topology'

const FIXTURES: [string, RepoSnapshot][] = [
  ['pmndrs/valtio', valtioFixture as unknown as RepoSnapshot],
  ['expressjs/express', expressFixture as unknown as RepoSnapshot],
]

const RADIUS_EPSILON = 1e-6

function angleOf(p: { x: number; z: number }): number {
  return Math.atan2(p.z, p.x)
}

/** Shortest signed angular distance from `a` to `b`, in `(-pi, pi]`. */
function shortestAngleDelta(a: number, b: number): number {
  const twoPi = Math.PI * 2
  const wrapped = (((b - a + Math.PI) % twoPi) + twoPi) % twoPi
  return wrapped - Math.PI
}

function buildColonyModel(snapshot: RepoSnapshot) {
  const bounds = computeTimeBounds(snapshot)
  const topology = buildHyphaTopology(snapshot, bounds)
  const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
  const colony = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases)
  return { bounds, topology, colony }
}

describe('layoutNetworkColony', () => {
  it('is deterministic: identical input always produces an identical layout', () => {
    const snapshot = makeSnapshot()
    const { bounds, topology } = buildColonyModel(snapshot)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const a = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases)
    const b = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases)
    expect(a).toEqual(b)
  })

  it('gives every PR hypha a monotonically non-decreasing disc-radius from start to end', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      let previous = -Infinity
      for (const point of hypha.points) {
        const radius = discRadius(point.position)
        expect(radius).toBeGreaterThanOrEqual(previous - RADIUS_EPSILON)
        previous = radius
      }
    }
  })

  it('never draws a single polyline segment longer than 0.3 world units (no disc-spanning chords)', () => {
    // Regression test for a real round-2 bug: a hypha's `points[0]` was
    // forced to its real parent's position, but every later sample was
    // computed from the parent's TANGENT direction instead of that same
    // position's own angle -- when the two meaningfully differed, the very
    // next sample jumped to a completely different angle at nearly the same
    // radius, drawing a multi-unit-long single-segment "chord" straight
    // across the disc (measured up to 9.4 world units on a real fixture).
    // `growHyphaPoints` now derives its own starting angle strictly from
    // `startPosition`, which is exact by construction, so this can't recur.
    // Measured on UN-swirled coordinates (see `unswirlPosition`'s doc): the
    // cosmetic galaxy swirl (M3) adds a small extra tangential displacement
    // between adjacent samples proportional to the local swirl gradient, on
    // top of this bound -- an honest property of swirling an already-sampled
    // curve, not a growth-algorithm regression, so it's the pre-swirl
    // geometry (this invariant's actual subject) that must hold the bound.
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      for (let i = 1; i < hypha.points.length; i++) {
        const a = unswirlPosition(hypha.points[i - 1]!.position, DEFAULT_LAYOUT_OPTIONS.swirl, DEFAULT_LAYOUT_OPTIONS.swirlPower)
        const b = unswirlPosition(hypha.points[i]!.position, DEFAULT_LAYOUT_OPTIONS.swirl, DEFAULT_LAYOUT_OPTIONS.swirlPower)
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThanOrEqual(0.3)
      }
    }
  })

  it('starts every hypha exactly on its parent\'s own curve, or exactly at the spore origin', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const nonMain = colony.hyphae.filter((h) => h.kind !== 'main')
    for (const hypha of nonMain) {
      const start = hypha.points[0]!.position
      const distToOrigin = vec3Length(start)
      if (distToOrigin <= 1e-6) continue // started at the spore -- exact by construction

      const r0 = discRadius(start)
      const matchesAnotherHypha = nonMain.some((other) => {
        if (other.id === hypha.id) return false
        const at = pointOnHyphaAtRadius(other.points, r0)
        return vec3Length(subVec3(at.position, start)) <= 1e-6
      })
      expect(matchesAnotherHypha).toBe(true)
    }
  })

  it('computeWorkLength (L_h) always stays within [Lmin, Lmax], for any commit/line count', () => {
    const cases: [number, number | null][] = [[0, null], [1, 0], [1, 5], [30, 2000], [500, 1_000_000], [3, null]]
    for (const [commits, lines] of cases) {
      const length = computeWorkLength(commits, lines)
      expect(length).toBeGreaterThanOrEqual(COLONY_LENGTH_MIN - 1e-9)
      expect(length).toBeLessThanOrEqual(COLONY_LENGTH_MAX + 1e-9)
    }
  })

  it('draws every non-spore-started hypha within the documented work-based length bounds', () => {
    // A spore-started hypha (nothing yet spans its own r0 -- see
    // `layoutNetworkColony`'s "r_end = r0 + L_h" comment) is a documented
    // exception: its RENDERED length is `r0 + L_h`, not `L_h` alone, since
    // it starts at the true origin regardless of how large its real r0 is
    // -- `computeWorkLength`'s own bounds (tested directly above) are what
    // the brief's "[Lmin*0.6, Lmax]" actually constrains.
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const minLength = COLONY_LENGTH_MIN * COLONY_CLOSED_LENGTH_MULTIPLIER
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      const start = hypha.points[0]!.position
      if (vec3Length(start) <= 1e-6) continue // spore-started -- see above
      const startR = discRadius(start)
      const end = discRadius(hypha.points[hypha.points.length - 1]!.position)
      const length = end - startR
      expect(length).toBeGreaterThanOrEqual(minLength - 1e-6)
      expect(length).toBeLessThanOrEqual(COLONY_LENGTH_MAX + 1e-6)
    }
  })

  it('keeps every hypha\'s post-fork angular drift within the documented bound (no arcs)', () => {
    // Measured relative to the swirl field, i.e. on UN-swirled coordinates
    // (`unswirlPosition`): this invariant is about the growth algorithm's
    // own organic wiggle, not about the cosmetic galaxy swirl (M3) layered
    // on top of it, which adds a large, intentional, radius-dependent
    // rotation that has nothing to do with "drift."
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main' || hypha.points.length < 6) continue
      const unswirled = hypha.points.map((p) => ({
        ...p,
        position: unswirlPosition(p.position, DEFAULT_LAYOUT_OPTIONS.swirl, DEFAULT_LAYOUT_OPTIONS.swirlPower),
      }))
      // Safely past the fork (<= 0.25) + drift ramp (0.15) = 0.4 of the path.
      const postForkStart = Math.ceil(unswirled.length * 0.45)
      const postFork = unswirled.slice(postForkStart)
      if (postFork.length < 2) continue
      const angles = postFork.map((p) => angleOf(p.position))
      const reference = angles[0]!
      // A hypha longer than COLONY_LENGTH_MAX (a spore-started one reaching
      // its own real, possibly large r0 -- see `layoutNetworkColony`'s
      // "r_end = r0 + L_h" comment) deliberately scales its wiggle up with
      // its own length (`growHyphaPoints`'s `lengthScale`), so its drift
      // bound scales the same way here.
      const totalLength = discRadius(hypha.points[hypha.points.length - 1]!.position) - discRadius(hypha.points[0]!.position)
      const lengthScale = Math.max(1, totalLength / COLONY_LENGTH_MAX)
      for (const angle of angles) {
        expect(Math.abs(shortestAngleDelta(reference, angle))).toBeLessThanOrEqual(0.1 * lengthScale + 1e-9)
      }
    }
  })

  it('gives a fusion knot to every merged hypha, and only merged hyphae', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const mergedIds = new Set(colony.hyphae.filter((h) => h.status === 'fused').map((h) => h.id))
    const fusionIds = new Set(colony.fusions.map((f) => f.hyphaId))
    expect(fusionIds).toEqual(mergedIds)
    for (const fusion of colony.fusions) {
      expect(Number.isFinite(fusion.bridgeTo.x)).toBe(true)
      expect(vec3Length({ x: fusion.bridgeTo.x - fusion.position.x, y: 0, z: fusion.bridgeTo.z - fusion.position.z })).toBeGreaterThanOrEqual(0)
    }
  })

  it('gives every open hypha a growing tip element', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const openIds = new Set(colony.hyphae.filter((h) => h.status === 'open' && h.kind !== 'main').map((h) => h.id))
    const tipIds = new Set(colony.tips.map((t) => t.hyphaId))
    expect(tipIds).toEqual(openIds)
  })

  it('places every mushroom exactly on its release\'s own growth ring radius', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const ringRadiusByRef = new Map(colony.rings.filter((r) => r.ringKind === 'release').map((r) => [r.ref!.id, r.radius]))
    for (const mushroom of colony.mushrooms) {
      const ringRadius = ringRadiusByRef.get(mushroom.ref.id)
      expect(ringRadius).toBeDefined()
      expect(discRadius(mushroom.position)).toBeCloseTo(ringRadius!, 6)
    }
  })

  it('grows exactly one hair per rendered commit node', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    expect(colony.hairs.length).toBe(colony.nodes.length)
    const nodeIds = new Set(colony.nodes.map((n) => n.id))
    for (const hair of colony.hairs) expect(nodeIds.has(hair.nodeId)).toBe(true)
  })

  describe('galaxy swirl', () => {
    const SWIRL = 1.6
    const POWER = 1.4

    it('swirlAngleForRadius is 0 at the spore, ramps monotonically to `swirl` at the rim, and is 0 when swirl is 0', () => {
      expect(swirlAngleForRadius(0, SWIRL, POWER)).toBe(0)
      expect(swirlAngleForRadius(DISC_MAX_RADIUS, SWIRL, POWER)).toBeCloseTo(SWIRL, 9)
      expect(swirlAngleForRadius(5, 0, POWER)).toBe(0)
      const half = swirlAngleForRadius(DISC_MAX_RADIUS / 2, SWIRL, POWER)
      const full = swirlAngleForRadius(DISC_MAX_RADIUS, SWIRL, POWER)
      expect(half).toBeGreaterThan(0)
      expect(half).toBeLessThan(full)
    })

    it('applySwirlToPosition preserves disc radius exactly (time honesty) and is a no-op at the origin', () => {
      const point = { x: 3, y: 0.01, z: 4 } // radius 5
      const swirled = applySwirlToPosition(point, SWIRL, POWER)
      expect(discRadius(swirled)).toBeCloseTo(discRadius(point), 9)
      expect(swirled.y).toBe(point.y)
      expect(applySwirlToPosition({ x: 0, y: 0, z: 0 }, SWIRL, POWER)).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('unswirlPosition exactly inverts applySwirlToPosition', () => {
      const point = { x: 1.2, y: 0, z: -2.7 }
      const swirled = applySwirlToPosition(point, SWIRL, POWER)
      const restored = unswirlPosition(swirled, SWIRL, POWER)
      expect(restored.x).toBeCloseTo(point.x, 9)
      expect(restored.z).toBeCloseTo(point.z, 9)
    })

    it('is deterministic with swirl enabled: identical input always produces an identical (swirled) layout', () => {
      const snapshot = makeSnapshot()
      const bounds = computeTimeBounds(snapshot)
      const topology = buildHyphaTopology(snapshot, bounds)
      const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
      const options = { swirl: SWIRL, swirlPower: POWER }
      const a = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, options)
      const b = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, options)
      expect(a).toEqual(b)
    })

    it('rotates every element kind (hyphae, nodes, tips, mushrooms, fusions, hairs) by the exact same radius-dependent angle', () => {
      // Build the SAME snapshot with swirl off and swirl on, then verify
      // every corresponding spatial value keeps its disc radius exactly and
      // shifts by exactly `swirlAngleForRadius(radius)` -- proof that the
      // transform is applied uniformly, not per-kind, for a NORMAL
      // (non-rigid) hypha. `makeSnapshot`'s tiny synthetic colony only ever
      // produces spore-started, longer-than-`COLONY_LENGTH_MAX` hyphae, so
      // this test never exercises the T10 rigid-swirl exception below -- see
      // the dedicated "rotates a short hypha rigidly" test (real fixture)
      // for that. A fusion bridge's
      // `bridgeTo` is the one other deliberate exception (see the dedicated
      // "rotates a fusion bridge rigidly" test below): it follows its own
      // TIP's swirl angle, not one re-derived from its own (possibly very
      // different) radius, so a short anastomosis bridge never stretches
      // into an odd-angled chord post-swirl (the T9 rim-artifact fix).
      const snapshot = makeSnapshot()
      const bounds = computeTimeBounds(snapshot)
      const topology = buildHyphaTopology(snapshot, bounds)
      const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
      const plain = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, { swirl: 0 })
      const swirled = applySwirl(plain, SWIRL, POWER)

      function assertConsistentSwirl(before: { x: number; y: number; z: number }, after: { x: number; y: number; z: number }) {
        const radius = discRadius(before)
        expect(discRadius(after)).toBeCloseTo(radius, 7)
        if (radius < 1e-6) return // spore/origin: angle undefined, no-op
        const expectedAngle = Math.atan2(before.z, before.x) + swirlAngleForRadius(radius, SWIRL, POWER)
        const actualAngle = Math.atan2(after.z, after.x)
        expect(Math.abs(shortestAngleDelta(expectedAngle, actualAngle))).toBeLessThan(1e-6)
      }

      for (let h = 0; h < plain.hyphae.length; h++) {
        for (let p = 0; p < plain.hyphae[h]!.points.length; p++) {
          assertConsistentSwirl(plain.hyphae[h]!.points[p]!.position, swirled.hyphae[h]!.points[p]!.position)
        }
      }
      for (let i = 0; i < plain.nodes.length; i++) assertConsistentSwirl(plain.nodes[i]!.position, swirled.nodes[i]!.position)
      for (let i = 0; i < plain.tips.length; i++) assertConsistentSwirl(plain.tips[i]!.position, swirled.tips[i]!.position)
      for (let i = 0; i < plain.mushrooms.length; i++) assertConsistentSwirl(plain.mushrooms[i]!.position, swirled.mushrooms[i]!.position)
      for (let i = 0; i < plain.fusions.length; i++) assertConsistentSwirl(plain.fusions[i]!.position, swirled.fusions[i]!.position)
      // A hair's base follows the same rule; its recomputed tip (base + direction*length) does too.
      for (let i = 0; i < plain.hairs.length; i++) {
        assertConsistentSwirl(plain.hairs[i]!.position, swirled.hairs[i]!.position)
        const plainTip = { x: plain.hairs[i]!.position.x + plain.hairs[i]!.direction.x * plain.hairs[i]!.length, y: 0, z: plain.hairs[i]!.position.z + plain.hairs[i]!.direction.z * plain.hairs[i]!.length }
        const swirledTip = { x: swirled.hairs[i]!.position.x + swirled.hairs[i]!.direction.x * swirled.hairs[i]!.length, y: 0, z: swirled.hairs[i]!.position.z + swirled.hairs[i]!.direction.z * swirled.hairs[i]!.length }
        assertConsistentSwirl(plainTip, swirledTip)
      }
      expect(plain.hyphae.length).toBeGreaterThan(0)
    })

    it('rotates a fusion bridge rigidly (T9 rim-artifact fix): bridgeTo follows the tip\'s own swirl angle, not one re-derived from its own radius', () => {
      // A bridge's two ends (`position`, the real tip, and `bridgeTo`, a
      // nearby hypha/ring/spore point) can sit at meaningfully different
      // disc radii. Independently re-deriving each end's own radius-based
      // swirl would rotate them by different amounts, stretching a bridge
      // `findFusionAnchor` bounded at `FUSION_SEARCH_RADIUS` (0.25)
      // pre-swirl into a longer, oddly-angled chord post-swirl. Rotating
      // `bridgeTo` RIGIDLY by the tip's own angle keeps the pre-swirl
      // bridge length and relative angle exactly intact.
      const snapshot = makeSnapshot()
      const bounds = computeTimeBounds(snapshot)
      const topology = buildHyphaTopology(snapshot, bounds)
      const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
      const plain = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, { swirl: 0 })
      const swirled = applySwirl(plain, SWIRL, POWER)
      expect(plain.fusions.length).toBeGreaterThan(0)

      for (let i = 0; i < plain.fusions.length; i++) {
        const before = plain.fusions[i]!
        const after = swirled.fusions[i]!
        const bridgeVecBefore = subVec3(before.bridgeTo, before.position)
        const bridgeVecAfter = subVec3(after.bridgeTo, after.position)
        // Pre-swirl bridge length is preserved EXACTLY (a rigid rotation of
        // the whole bridge segment, not two independently-rotated ends).
        expect(vec3Length(bridgeVecAfter)).toBeCloseTo(vec3Length(bridgeVecBefore), 7)
        // bridgeTo's own disc radius is still preserved (any rotation around
        // Y leaves distance-from-origin unchanged), but its ANGLE follows
        // the TIP's swirl, not one re-derived from its own radius.
        const tipRadius = discRadius(before.position)
        const rigidAngle = tipRadius < 1e-6 ? 0 : swirlAngleForRadius(tipRadius, SWIRL, POWER)
        const bridgeRadius = discRadius(before.bridgeTo)
        if (bridgeRadius >= 1e-6) {
          const expectedAngle = Math.atan2(before.bridgeTo.z, before.bridgeTo.x) + rigidAngle
          const actualAngle = Math.atan2(after.bridgeTo.z, after.bridgeTo.x)
          expect(Math.abs(shortestAngleDelta(expectedAngle, actualAngle))).toBeLessThan(1e-6)
        }
      }
    })

    it('leaves the layout unchanged when swirl is 0 (opt-out)', () => {
      const snapshot = makeSnapshot()
      const { bounds, topology } = buildColonyModel(snapshot)
      const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
      const noSwirl = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, { swirl: 0 })
      const alsoNoSwirl = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, { swirl: 0, swirlPower: 3 })
      expect(noSwirl).toEqual(alsoNoSwirl)
    })
  })

  it('never produces a NaN/non-finite number anywhere in the layout', () => {
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    const stack: unknown[] = [colony]
    while (stack.length > 0) {
      const value = stack.pop()
      if (typeof value === 'number') {
        expect(Number.isFinite(value)).toBe(true)
      } else if (Array.isArray(value)) {
        stack.push(...value)
      } else if (value && typeof value === 'object') {
        stack.push(...Object.values(value))
      }
    }
  })

  it('produces a spore + a single degenerate main entry for a tiny repo (0 PRs, 0 releases, 1 commit)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [
        { oid: 'first', messageHeadline: 'init', authoredDate: '2024-01-01T00:00:00Z', author: { login: 'root', avatarUrl: null }, url: 'https://x/first' },
      ],
    })
    const { colony } = buildColonyModel(snapshot)
    expect(colony.spore).toBeDefined()
    expect(colony.hyphae).toHaveLength(1)
    expect(colony.hyphae[0]!.kind).toBe('main')
    // No releases -- only real *year* rings (from the repo's real
    // created/pushed-at span) may appear, never a release ring.
    expect(colony.rings.every((r) => r.ringKind === 'year')).toBe(true)
    expect(colony.mushrooms).toHaveLength(0)
    expect(colony.fusions).toHaveLength(0)
    expect(colony.nodes).toHaveLength(1)
    expect(colony.hairs).toHaveLength(1)
  })

  describe('gap-filling sanity (synthetic 200-PR repo)', () => {
    function buildLargeSyntheticSnapshot(): RepoSnapshot {
      const author: CommitAuthor = { login: 'octocat', avatarUrl: null }
      const base = Date.parse('2018-01-01T00:00:00Z')
      const intervalMs = 86_400_000 * 4 // ~2.2 years across 200 PRs
      const mergedPullRequests: MergedPullRequest[] = Array.from({ length: 200 }, (_, i) => {
        const splitAt = base + i * intervalMs
        const mergedAt = splitAt + 86_400_000 * 2
        return {
          number: i + 1,
          title: `PR ${i + 1}`,
          author,
          mergedAt: new Date(mergedAt).toISOString(),
          createdAt: new Date(splitAt).toISOString(),
          url: `https://x/${i + 1}`,
          baseRefName: 'main',
          headRefName: `pr-${i + 1}`,
          firstCommitTime: new Date(splitAt).toISOString(),
          // Heavy, uniform work -> every hypha clamps to COLONY_LENGTH_MAX,
          // so exactly which ones cross a given radius band is predictable.
          additions: 2000,
          deletions: 1000,
          changedFiles: 20,
          labels: [],
          commitCount: 30,
          commits: [{ oid: `oid-${i}`, messageHeadline: 'x', authoredDate: new Date(splitAt + 1000).toISOString(), author, url: 'https://x' }],
        }
      })
      const lastMergedAt = base + (200 - 1) * intervalMs + 86_400_000 * 2
      return makeSnapshot({
        // `computeTimeBounds` also folds in `meta.createdAt`/`pushedAt` and
        // `fetchedAt` -- without overriding these too, `makeSnapshot`'s
        // defaults (2020/2024) would stretch `bounds` far past this
        // synthetic repo's real 2018-2020 PR history, squashing all 200 PRs
        // into a small inner fraction of the disc instead of spreading them
        // across it.
        meta: {
          owner: 'octo-org',
          name: 'octo-repo',
          description: 'A test repository',
          url: 'https://github.com/octo-org/octo-repo',
          stars: 42,
          forks: 4,
          createdAt: new Date(base).toISOString(),
          pushedAt: new Date(lastMergedAt).toISOString(),
          defaultBranch: 'main',
          license: 'MIT License',
        },
        fetchedAt: new Date(lastMergedAt).toISOString(),
        mergedPullRequests,
        openPullRequests: [],
        closedPullRequests: [],
        liveBranches: [],
        releases: [],
        directCommits: [],
      })
    }

    it('has no angular gap wider than 60 degrees at r = 0.8*R', () => {
      const snapshot = buildLargeSyntheticSnapshot()
      const { colony } = buildColonyModel(snapshot)
      const targetRadius = DISC_MAX_RADIUS * 0.8

      const angles: number[] = []
      for (const hypha of colony.hyphae) {
        if (hypha.kind === 'main') continue
        const start = discRadius(hypha.points[0]!.position)
        const end = discRadius(hypha.points[hypha.points.length - 1]!.position)
        if (targetRadius < start || targetRadius > end) continue
        const at = pointOnHyphaAtRadius(hypha.points, targetRadius)
        angles.push(angleOf(at.position))
      }

      // Sanity on the test's own setup: this synthetic repo should actually
      // produce a meaningful number of hyphae crossing this radius band.
      expect(angles.length).toBeGreaterThan(10)

      const twoPi = Math.PI * 2
      const sorted = angles.map((a) => ((a % twoPi) + twoPi) % twoPi).sort((a, b) => a - b)
      let maxGap = 0
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i]!
        const b = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + twoPi
        maxGap = Math.max(maxGap, b - a)
      }
      expect(maxGap).toBeLessThanOrEqual((Math.PI / 3) * 1.05) // 60 degrees, tiny float-safety margin
    })
  })

  describe.each(FIXTURES)('%s (real fixture smoke test)', (_name, snapshot) => {
    it('builds a sane colony model via buildNetwork', () => {
      const model = buildNetwork(snapshot)
      expect(model.layout).toBe('colony')
      expect(model.hyphae.length).toBeGreaterThan(1)
      expect(model.rings.length).toBeGreaterThan(0)
      expect(model.fusions.length).toBeGreaterThan(0)
      expect(model.hairs.length).toBe(model.nodes.length)
      expect(model.bounds.radius).toBeGreaterThan(0)
      expect(Number.isFinite(model.bounds.radius)).toBe(true)
      // "clamp open/long hyphae so the disc stays round" (round 2
      // orchestrator feedback) -- hyphae are hard-capped at
      // `DISC_MAX_RADIUS * 1.05`; a little extra slack here covers the
      // mushroom lift and hair length added on top of a hypha's own tip.
      expect(model.bounds.radius).toBeLessThanOrEqual(DISC_MAX_RADIUS * 1.15)
    })

    it('records a real nearPr data link for at least one mushroom, when releases and merged PRs coexist', () => {
      const model = buildNetwork(snapshot)
      if (model.mushrooms.length === 0) return
      const anyLinked = model.mushrooms.some((m) => m.nearPr !== null)
      expect(anyLinked).toBe(true)
    })

    // T9: rim "hook"/blocky-fragment fix regression coverage -- see
    // `relaxSharpTurns`/`MAX_HYPHA_TURN_RAD`/`POST_FORK_LATERAL_LENGTH_CAP_
    // FRACTION`/`buildForkBiasedSampleTimes` in `colonyLayout.ts` for the
    // root cause and fix. Exercised against the real bundled fixtures (not a
    // synthetic snapshot) since the artifact only showed up at real-repo
    // scale, concentrated at the disc rim.
    it('has no hypha polyline segment turning more than 60 degrees from its predecessor', () => {
      const model = buildNetwork(snapshot)
      let checked = 0
      for (const hypha of model.hyphae) {
        if (hypha.kind === 'main') continue
        const points = hypha.points
        for (let i = 1; i < points.length - 1; i++) {
          const a = points[i - 1]!.position
          const b = points[i]!.position
          const c = points[i + 1]!.position
          const v1x = b.x - a.x
          const v1z = b.z - a.z
          const v2x = c.x - b.x
          const v2z = c.z - b.z
          const len1 = Math.hypot(v1x, v1z)
          const len2 = Math.hypot(v2x, v2z)
          if (len1 < 1e-9 || len2 < 1e-9) continue // degenerate segment: covered by the pile-up test below
          const cosTurn = Math.max(-1, Math.min(1, (v1x * v2x + v1z * v2z) / (len1 * len2)))
          const turnDeg = (Math.acos(cosTurn) * 180) / Math.PI
          checked += 1
          expect(turnDeg).toBeLessThanOrEqual(60 + 1e-6)
        }
      }
      // Sanity on the test's own coverage: this fixture should actually
      // exercise a meaningful number of interior turns.
      expect(checked).toBeGreaterThan(100)
    })

    it('never repeats a near-zero-length segment (no point pile-up) along a hypha polyline', () => {
      const model = buildNetwork(snapshot)
      const EPSILON = 1e-4
      for (const hypha of model.hyphae) {
        if (hypha.kind === 'main') continue
        const points = hypha.points
        let consecutiveTinySegments = 0
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1]!.position
          const b = points[i]!.position
          const segmentLength = Math.hypot(b.x - a.x, b.z - a.z)
          consecutiveTinySegments = segmentLength < EPSILON ? consecutiveTinySegments + 1 : 0
          // A single near-zero segment can legitimately happen (e.g. right
          // at the spore); TWO in a row means several points collapsed onto
          // (almost) the same spot -- the actual pile-up shape this guards
          // against.
          expect(consecutiveTinySegments).toBeLessThan(2)
        }
      }
    })

    // T10 (second-pass rim fix) regression coverage -- see
    // `WIDTH_TO_LENGTH_CAP_FRACTION`/`FORK_RENDER_LATERAL_BUDGET_FRACTION`/
    // `rigidSwirlAngleByHyphaId` in `colonyLayout.ts` for the root causes and
    // fixes (a thick wedge from commit-driven width outliving a rim-clamped
    // rendered length, and a visible base-hugging "L" bend from the fork's
    // own turn + the swirl field's own steepest-near-the-rim gradient).
    // Exercised against the real bundled fixtures, like the T9 tests above,
    // since the artifact only showed up at real-repo scale.
    it('caps every hypha\'s base radius at WIDTH_TO_LENGTH_CAP_FRACTION times its own radial span (no thick-relative-to-length wedge)', () => {
      const model = buildNetwork(snapshot)
      let checked = 0
      for (const hypha of model.hyphae) {
        if (hypha.kind === 'main' || hypha.points.length < 2) continue
        const startRadius = discRadius(hypha.points[0]!.position)
        const endRadius = discRadius(hypha.points[hypha.points.length - 1]!.position)
        const radialSpan = Math.max(0, endRadius - startRadius)
        if (radialSpan <= 0) continue
        checked += 1
        expect(hypha.points[0]!.radius).toBeLessThanOrEqual(radialSpan * WIDTH_TO_LENGTH_CAP_FRACTION + 1e-9)
      }
      expect(checked).toBeGreaterThan(100)
    })

    it('bounds a short hypha\'s max lateral wiggle to a modest fraction of its own length (no base-hugging hook)', () => {
      // Direct geometric proxy for "cumulative fork turn bounded by length":
      // the fork's own achievable turn (`maxTurnRadians`, using
      // `FORK_RENDER_LATERAL_BUDGET_FRACTION`) and the post-fork drift
      // (`POST_FORK_LATERAL_LENGTH_CAP_FRACTION`) both scale with the
      // hypha's own length, so their combined visible effect -- how far the
      // polyline ever strays sideways from its own straight base->tip chord,
      // as a fraction of its own rendered length -- should stay modest for
      // a NORMAL (non-spore-started, radial span <= `COLONY_LENGTH_MAX`)
      // hypha, which is what the rim-hook artifact was actually made of.
      // Deliberately excludes a genuinely long, spore-started arm (span >
      // `COLONY_LENGTH_MAX`): visibly meandering over its own much longer
      // run is an existing, intended design characteristic (see
      // `growHyphaPoints`'s `lengthScale` doc comment), not the T10 defect
      // -- those legitimately reach ~26-32% on both bundled fixtures. Before
      // the T10 fix, a NORMAL short hypha reached ~40% (a visible "L" hook);
      // 20% is a real, still-generous ceiling for that population that
      // would have caught it.
      const model = buildNetwork(snapshot)
      let checked = 0
      for (const hypha of model.hyphae) {
        if (hypha.kind === 'main' || hypha.points.length < 3) continue
        const startRadius = discRadius(hypha.points[0]!.position)
        const endRadius = discRadius(hypha.points[hypha.points.length - 1]!.position)
        if (endRadius - startRadius > COLONY_LENGTH_MAX) continue
        const base = hypha.points[0]!.position
        const tip = hypha.points[hypha.points.length - 1]!.position
        const dx = tip.x - base.x
        const dz = tip.z - base.z
        const chordLength = Math.hypot(dx, dz)
        if (chordLength < 1e-6) continue
        const ux = dx / chordLength
        const uz = dz / chordLength
        let maxLateralDeviation = 0
        let arcLength = 0
        for (let i = 1; i < hypha.points.length; i++) {
          const a = hypha.points[i - 1]!.position
          const b = hypha.points[i]!.position
          arcLength += Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y)
        }
        for (const point of hypha.points) {
          const px = point.position.x - base.x
          const pz = point.position.z - base.z
          const perp = Math.abs(px * -uz + pz * ux)
          if (perp > maxLateralDeviation) maxLateralDeviation = perp
        }
        if (arcLength < 1e-6) continue
        checked += 1
        expect(maxLateralDeviation / arcLength).toBeLessThanOrEqual(0.2)
      }
      expect(checked).toBeGreaterThan(100)
    })

    it('rotates a short hypha (radial span <= COLONY_LENGTH_MAX) rigidly by one fixed angle, not independently per point', () => {
      // The `makeSnapshot()`-based "rotates every element kind..." test
      // above only ever produces spore-started, longer-than-`COLONY_LENGTH_
      // MAX` hyphae, so it never exercises this T10 exception -- exercised
      // here against a real fixture instead, which does have plenty of
      // short (real-attach-point) hyphae. A real fixture's own topology
      // differs slightly with `swirl: 0` vs the real `DEFAULT_LAYOUT_
      // OPTIONS.swirl` (the topology's own natural-fit search is swirl-
      // independent by construction, so hypha COUNT and per-hypha radial
      // span match either way -- only each point's rotated ANGLE differs).
      const plain = buildNetwork(snapshot, { swirl: 0 })
      const swirled = buildNetwork(snapshot)
      let checked = 0

      for (let h = 0; h < plain.hyphae.length; h++) {
        const plainHypha = plain.hyphae[h]!
        const swirledHypha = swirled.hyphae[h]!
        if (plainHypha.kind === 'main' || plainHypha.points.length < 2) continue
        const startRadius = discRadius(plainHypha.points[0]!.position)
        const endRadius = discRadius(plainHypha.points[plainHypha.points.length - 1]!.position)
        if (endRadius - startRadius > COLONY_LENGTH_MAX) continue // long/spore-started: independent per-point swirl, covered by the generic test above
        checked += 1

        const rigidAngle = startRadius < 1e-6 ? 0 : swirlAngleForRadius(startRadius, DEFAULT_LAYOUT_OPTIONS.swirl, DEFAULT_LAYOUT_OPTIONS.swirlPower)
        for (let p = 0; p < plainHypha.points.length; p++) {
          const before = plainHypha.points[p]!.position
          const after = swirledHypha.points[p]!.position
          const radius = discRadius(before)
          expect(discRadius(after)).toBeCloseTo(radius, 7)
          if (radius < 1e-6) continue
          // Every point of a short hypha rotates by the SAME fixed angle
          // (the one at its own real attach-point radius), not by its own
          // (different) per-point radius-based angle -- that's the whole
          // point of the fix: an already near-straight short strand stays
          // near-straight instead of picking up extra curvature from the
          // swirl field's own gradient.
          const expectedAngle = Math.atan2(before.z, before.x) + rigidAngle
          const actualAngle = Math.atan2(after.z, after.x)
          expect(Math.abs(shortestAngleDelta(expectedAngle, actualAngle))).toBeLessThan(1e-6)
        }
      }
      expect(checked).toBeGreaterThan(50)
    })
  })
})
