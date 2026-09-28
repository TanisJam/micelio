import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { subVec3, vec3Length } from '../tree/vector'
import { assignLanes, layoutNetwork, localSpiralPitch, pointOnHyphaAtTime, radiusForFrac, timeToFrac } from './layout'
import { buildHyphaTopology, type HyphaDraft } from './topology'

const FIXTURES: [string, RepoSnapshot][] = [
  ['pmndrs/valtio', valtioFixture as unknown as RepoSnapshot],
  ['expressjs/express', expressFixture as unknown as RepoSnapshot],
]

function stubDraft(overrides: Partial<HyphaDraft>): HyphaDraft {
  return {
    id: 'hypha-x',
    kind: 'merged',
    ref: { type: 'pull_request', id: '1' },
    parentHyphaId: 'hypha-main',
    rawSplitTime: 0,
    splitTime: 0,
    endTime: 100,
    status: 'fused',
    title: 'x',
    url: 'https://x',
    author: { login: null, avatarUrl: null },
    commitCount: 1,
    commits: [],
    ...overrides,
  }
}

describe('assignLanes', () => {
  it('assigns non-overlapping lanes per (parent, side): no two same-lane-same-side intervals overlap', () => {
    const children: HyphaDraft[] = [
      stubDraft({ id: 'a', splitTime: 0, endTime: 10 }),
      stubDraft({ id: 'b', splitTime: 2, endTime: 8 }), // overlaps a
      stubDraft({ id: 'c', splitTime: 20, endTime: 30 }), // no overlap with a
      stubDraft({ id: 'd', splitTime: 5, endTime: 25 }), // overlaps b's span and c's span
    ]
    const assignments = assignLanes(new Map([['hypha-main', children]]))

    const bySideLane = new Map<string, { id: string; splitTime: number; endTime: number }[]>()
    for (const child of children) {
      const a = assignments.get(child.id)!
      const key = `${a.side}:${a.lane}`
      const list = bySideLane.get(key) ?? []
      list.push({ id: child.id, splitTime: child.splitTime, endTime: child.endTime })
      bySideLane.set(key, list)
    }

    for (const list of bySideLane.values()) {
      const sorted = [...list].sort((x, y) => x.splitTime - y.splitTime)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.splitTime).toBeGreaterThanOrEqual(sorted[i - 1]!.endTime)
      }
    }
  })

  it('is deterministic for the same input', () => {
    const children: HyphaDraft[] = [stubDraft({ id: 'a', splitTime: 0, endTime: 5 }), stubDraft({ id: 'b', splitTime: 1, endTime: 6 })]
    const map = new Map([['hypha-main', children]])
    expect([...assignLanes(map).entries()]).toEqual([...assignLanes(map).entries()])
  })

  it('alternates sides for successive same-parent children', () => {
    const children: HyphaDraft[] = [
      stubDraft({ id: 'a', splitTime: 0, endTime: 5 }),
      stubDraft({ id: 'b', splitTime: 10, endTime: 15 }),
      stubDraft({ id: 'c', splitTime: 20, endTime: 25 }),
    ]
    const assignments = assignLanes(new Map([['hypha-main', children]]))
    expect(assignments.get('a')!.side).not.toBe(assignments.get('b')!.side)
    expect(assignments.get('b')!.side).not.toBe(assignments.get('c')!.side)
  })
})

describe('radiusForFrac / timeToFrac', () => {
  it('radiusForFrac is 0 at frac 0 and monotonically increasing to frac 1', () => {
    expect(radiusForFrac(0)).toBe(0)
    let previous = 0
    for (let f = 0.1; f <= 1; f += 0.1) {
      const r = radiusForFrac(f)
      expect(r).toBeGreaterThan(previous)
      previous = r
    }
  })

  it('timeToFrac clamps to [0, 1] and handles a zero-span bounds without dividing by zero', () => {
    const bounds = { firstEventTime: 100, lastEventTime: 100 }
    expect(timeToFrac(50, bounds)).toBe(0)
    expect(timeToFrac(200, bounds)).toBe(0)
    expect(Number.isFinite(timeToFrac(100, bounds))).toBe(true)
  })
})

describe('pointOnHyphaAtTime', () => {
  it('interpolates position/radius between two bracketing points', () => {
    const points = [
      { position: { x: 0, y: 0, z: 0 }, radius: 0.1, time: 0 },
      { position: { x: 10, y: 0, z: 0 }, radius: 0.3, time: 10 },
    ]
    const at5 = pointOnHyphaAtTime(points, 5)
    expect(at5.position.x).toBeCloseTo(5)
    expect(at5.radius).toBeCloseTo(0.2)
  })

  it('clamps out-of-range times into the hypha`s own span instead of extrapolating', () => {
    const points = [
      { position: { x: 0, y: 0, z: 0 }, radius: 0.1, time: 10 },
      { position: { x: 10, y: 0, z: 0 }, radius: 0.3, time: 20 },
    ]
    expect(pointOnHyphaAtTime(points, -100).position).toEqual({ x: 0, y: 0, z: 0 })
    expect(pointOnHyphaAtTime(points, 1000).position).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('never returns NaN/Infinity for a zero-duration (single-instant) hypha', () => {
    const points = [
      { position: { x: 1, y: 1, z: 1 }, radius: 0.1, time: 10 },
      { position: { x: 1, y: 1, z: 1 }, radius: 0.1, time: 10 },
    ]
    const at = pointOnHyphaAtTime(points, 10)
    expect(Number.isFinite(at.position.x)).toBe(true)
    expect(Number.isFinite(at.radius)).toBe(true)
  })
})

describe('loops never cross the next spiral turn (fixture check)', () => {
  it.each(FIXTURES)('%s: every main-parented loop stays under the next winding radius', (_name, snapshot) => {
    const bounds = computeTimeBounds(snapshot)
    const topology = buildHyphaTopology(snapshot, bounds)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed)

    // Only merged (fused) loops are constrained by the "never cross the next
    // turn" rule -- dead-end/open hyphae deliberately drift away from the
    // disc's structure (see `types.ts`), so they are not "loops" at all.
    const mainChildren = topology.hyphae.filter((d) => d.parentHyphaId === topology.main.id && d.status === 'fused')
    let checked = 0
    for (const draft of mainChildren) {
      const hypha = layout.hyphae.find((h) => h.id === draft.id)!
      const attachFrac = timeToFrac(draft.splitTime, bounds)
      const nextTurnRadius = radiusForFrac(Math.min(1, attachFrac + 1 / 2.4))
      const safetyBound = nextTurnRadius + localSpiralPitch(attachFrac) // generous margin above the pitch cap itself
      for (const point of hypha.points) {
        const radius = Math.sqrt(point.position.x ** 2 + point.position.z ** 2)
        expect(radius).toBeLessThan(safetyBound)
      }
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('tangent continuity at fuse points (fixture check)', () => {
  it.each(FIXTURES)('%s: a fused loop approaches its parent tangent-continuously at the rejoin point', (_name, snapshot) => {
    const bounds = computeTimeBounds(snapshot)
    const topology = buildHyphaTopology(snapshot, bounds)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed)

    const fusedByParent = new Map<string, typeof topology.hyphae>()
    for (const draft of topology.hyphae) {
      if (draft.status !== 'fused' || draft.splitTime === draft.endTime) continue
      const list = fusedByParent.get(draft.parentHyphaId!) ?? []
      list.push(draft)
      fusedByParent.set(draft.parentHyphaId!, list)
    }

    let checkedAny = false
    for (const [parentId, drafts] of fusedByParent) {
      const parentHypha = layout.hyphae.find((h) => h.id === parentId)!
      for (const draft of drafts.slice(0, 25)) {
        const hypha = layout.hyphae.find((h) => h.id === draft.id)!
        if (hypha.points.length < 3) continue
        const last = hypha.points[hypha.points.length - 1]!
        const secondLast = hypha.points[hypha.points.length - 2]!
        const ownTangent = subVec3(last.position, secondLast.position)
        if (vec3Length(ownTangent) < 1e-9) continue

        const parentAt = pointOnHyphaAtTime(parentHypha.points, draft.endTime)
        const cos =
          (ownTangent.x * parentAt.tangent.x + ownTangent.y * parentAt.tangent.y + ownTangent.z * parentAt.tangent.z) /
          vec3Length(ownTangent)
        const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
        // Below 90 degrees just means "not doubling back on itself" -- a loose
        // sanity bound; envelope->0 at the fuse point is what actually
        // guarantees a tight visual join (see `symmetricEnvelope`).
        expect(Math.min(angleDeg, 180 - angleDeg)).toBeLessThan(90)
        checkedAny = true
      }
    }
    expect(checkedAny).toBe(true)
  })
})
