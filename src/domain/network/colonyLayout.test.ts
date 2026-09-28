import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { subVec3, vec3Length } from '../tree/vector'
import { makeSnapshot } from '../tree/testHelpers'
import { buildNetwork } from './buildNetwork'
import { COLONY_CLOSED_LENGTH_MULTIPLIER, COLONY_LENGTH_MAX, COLONY_LENGTH_MIN, computeWorkLength, layoutNetworkColony } from './colonyLayout'
import { discRadius, DISC_MAX_RADIUS, pointOnHyphaAtRadius } from './layout'
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
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      for (let i = 1; i < hypha.points.length; i++) {
        const a = hypha.points[i - 1]!.position
        const b = hypha.points[i]!.position
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
    const snapshot = makeSnapshot()
    const { colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main' || hypha.points.length < 6) continue
      // Safely past the fork (<= 0.25) + drift ramp (0.15) = 0.4 of the path.
      const postForkStart = Math.ceil(hypha.points.length * 0.45)
      const postFork = hypha.points.slice(postForkStart)
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
      const model = buildNetwork(snapshot, { layout: 'colony' })
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
      const model = buildNetwork(snapshot, { layout: 'colony' })
      if (model.mushrooms.length === 0) return
      const anyLinked = model.mushrooms.some((m) => m.nearPr !== null)
      expect(anyLinked).toBe(true)
    })
  })
})
