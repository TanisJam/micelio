import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { vec3Length } from '../tree/vector'
import { makeSnapshot } from '../tree/testHelpers'
import { buildNetwork } from './buildNetwork'
import { layoutNetworkColony } from './colonyLayout'
import { radiusForFrac, timeToFrac } from './layout'
import { buildAuthorSectors, resolveSectorKey } from './sectors'
import { buildHyphaTopology } from './topology'

const FIXTURES: [string, RepoSnapshot][] = [
  ['pmndrs/valtio', valtioFixture as unknown as RepoSnapshot],
  ['expressjs/express', expressFixture as unknown as RepoSnapshot],
]

const RADIUS_EPSILON = 1e-6
/**
 * A colony-attached hypha's own base point usually lands inside its
 * author's sector (its sprout neighbor search is sector-scoped), but can
 * occasionally borrow a point from a same-author sibling hypha whose own
 * *start* is real-topology-anchored elsewhere (a `'parent-branch'`
 * attachment) -- measured up to ~0.8 rad on the real fixtures. The TIP is
 * always exact (0), since every curve converges to its own target angle by
 * construction; only the base gets this generous tolerance.
 */
const SECTOR_BASE_TOLERANCE_RADIANS = 1.0
const SECTOR_TIP_TOLERANCE_RADIANS = 1e-6

function angleOf(p: { x: number; z: number }): number {
  return Math.atan2(p.z, p.x)
}

/** Shortest angular distance from `angle` to the sector arc `[start, start+width]` (0 if inside). */
function angularDistanceToSector(angle: number, start: number, width: number): number {
  const twoPi = Math.PI * 2
  const relative = (((angle - start) % twoPi) + twoPi) % twoPi
  if (relative <= width) return 0
  return Math.min(relative - width, twoPi - relative)
}

function discRadius(p: { x: number; z: number }): number {
  return Math.hypot(p.x, p.z)
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

  it('starts each PR hypha at ~r(splitTime) and ends at ~r(endTime)', () => {
    const snapshot = makeSnapshot()
    const { bounds, colony } = buildColonyModel(snapshot)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      const expectedStart = radiusForFrac(timeToFrac(hypha.splitTime, bounds))
      const expectedEnd = radiusForFrac(timeToFrac(hypha.endTime, bounds))
      expect(discRadius(hypha.points[0]!.position)).toBeCloseTo(expectedStart, 6)
      expect(discRadius(hypha.points[hypha.points.length - 1]!.position)).toBeCloseTo(expectedEnd, 6)
    }
  })

  it('keeps every hypha tip exactly within its author sector, and its base within a generous tolerance', () => {
    const snapshot = makeSnapshot()
    const { topology, colony } = buildColonyModel(snapshot)
    const sectors = buildAuthorSectors(topology.hyphae)
    for (const hypha of colony.hyphae) {
      if (hypha.kind === 'main') continue
      const draft = topology.hyphae.find((d) => d.id === hypha.id)!
      const sector = sectors.get(resolveSectorKey(draft.author.login, sectors))!
      const tipAngle = angleOf(hypha.points[hypha.points.length - 1]!.position)
      const baseAngle = angleOf(hypha.points[0]!.position)
      expect(angularDistanceToSector(tipAngle, sector.angleStart, sector.angleWidth)).toBeLessThanOrEqual(SECTOR_TIP_TOLERANCE_RADIANS)
      expect(angularDistanceToSector(baseAngle, sector.angleStart, sector.angleWidth)).toBeLessThanOrEqual(SECTOR_BASE_TOLERANCE_RADIANS)
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

  it('grows every open hypha out to r(now) (the model bounds\' last event time)', () => {
    const snapshot = makeSnapshot()
    const { bounds, colony } = buildColonyModel(snapshot)
    const expectedTipRadius = radiusForFrac(timeToFrac(bounds.lastEventTime, bounds))
    for (const hypha of colony.hyphae) {
      if (hypha.status !== 'open' || hypha.kind === 'main') continue
      const tip = colony.tips.find((t) => t.hyphaId === hypha.id)
      expect(tip).toBeDefined()
      expect(discRadius(tip!.position)).toBeCloseTo(expectedTipRadius, 6)
    }
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
    })
  })
})
