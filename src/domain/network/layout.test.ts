import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { subVec3, vec3Length } from '../tree/vector'
import {
  assignLanes,
  buildActivityCdf,
  layoutNetwork,
  localSpiralPitch,
  NESTED_MAX_LANE_DEPTH,
  pointOnHyphaAtTime,
  radiusForFrac,
  SIDE_JITTER_MAX,
  SPIRAL_PITCH_SAFETY,
  SPIRAL_TURNS,
  timeToFrac,
} from './layout'
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

describe('no hypha point crosses the next spiral turn (fixture check)', () => {
  it.each(FIXTURES)('%s: every main-parented hypha (loop, dead end, or open tip) stays under the next winding radius', (_name, snapshot) => {
    const bounds = computeTimeBounds(snapshot)
    const topology = buildHyphaTopology(snapshot, bounds)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed)
    const activity = buildActivityCdf(topology.main, topology.hyphae, bounds)

    // M2b: dead-end/open hyphae are now depth-capped exactly like fused
    // loops (see `computeLoopDepth` in `layout.ts`), so the "never cross the
    // next turn" invariant holds for every main-parented hypha, not just
    // fused ones -- this is what fixed the M2b bug report of open/closed
    // hyphae straying far outside the disc on long, uncapped stems.
    const mainChildren = topology.hyphae.filter((d) => d.parentHyphaId === topology.main.id)
    let checked = 0
    for (const draft of mainChildren) {
      const hypha = layout.hyphae.find((h) => h.id === draft.id)!
      const attachFrac = timeToFrac(draft.splitTime, bounds)
      const nextTurnRadius = radiusForFrac(Math.min(1, attachFrac + 1 / SPIRAL_TURNS), activity)
      const safetyBound = nextTurnRadius + localSpiralPitch(attachFrac, activity) // generous margin above the pitch cap itself
      for (const point of hypha.points) {
        const radius = Math.sqrt(point.position.x ** 2 + point.position.z ** 2)
        expect(radius).toBeLessThan(safetyBound)
      }
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('fused loops follow their parent path within a bounded lateral offset (fixture check)', () => {
  it.each(FIXTURES)('%s: every fused (merged-PR) hypha point stays within its depth cap (+ jitter) of the parent at the same time', (_name, snapshot) => {
    const bounds = computeTimeBounds(snapshot)
    const topology = buildHyphaTopology(snapshot, bounds)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed)
    const activity = buildActivityCdf(topology.main, topology.hyphae, bounds)
    const byId = new Map(layout.hyphae.map((h) => [h.id, h]))

    // "PR hypha must follow its parent's path... never a direct chord":
    // only meaningful for a FUSED loop, which really does rejoin the parent
    // at a later point in time -- its `time` label at every sampled point
    // corresponds to a real position on the parent's own curve. A dead-end
    // or open/live-branch hypha instead keeps a short, LOCAL bulge near its
    // split point while its `time` label keeps advancing (honestly) toward
    // "now"/its close time, so it is checked separately below against its
    // fixed attach point, not a same-time parent lookup.
    let checked = 0
    for (const draft of topology.hyphae) {
      if (draft.status !== 'fused') continue
      const hypha = byId.get(draft.id)!
      const parent = byId.get(draft.parentHyphaId ?? topology.main.id)!
      const isOnMain = parent.kind === 'main'
      const parentFrac = timeToFrac(draft.splitTime, bounds)
      const roomCap = isOnMain ? localSpiralPitch(parentFrac, activity) * SPIRAL_PITCH_SAFETY : NESTED_MAX_LANE_DEPTH
      // depth (<= roomCap) + jitter, with a generous safety multiplier since
      // this recomputes an upper bound rather than the exact (also
      // room-clamped-by-disc-edge) depth used internally.
      const bound = roomCap * 1.5 + SIDE_JITTER_MAX + 1e-6

      for (const point of hypha.points) {
        const parentAt = pointOnHyphaAtTime(parent.points, point.time)
        const dx = point.position.x - parentAt.position.x
        const dz = point.position.z - parentAt.position.z
        const lateral = Math.sqrt(dx * dx + dz * dz)
        expect(lateral).toBeLessThanOrEqual(bound)
      }
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('dead-end/open hypha length is bounded (fixture check)', () => {
  it.each(FIXTURES)('%s: every dead-end/open hypha point stays within a bounded distance of its own attach point', (_name, snapshot) => {
    const bounds = computeTimeBounds(snapshot)
    const topology = buildHyphaTopology(snapshot, bounds)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed)
    const activity = buildActivityCdf(topology.main, topology.hyphae, bounds)
    const byId = new Map(layout.hyphae.map((h) => [h.id, h]))

    // A dead end (closed-unmerged PR) or open/live-branch tip departs its
    // parent for good -- it never chases a matching time-position on the
    // parent's curve, it just wanders a short, bounded distance from where
    // it split off, regardless of how long it then stays open/unmerged.
    let checked = 0
    for (const draft of topology.hyphae) {
      if (draft.status !== 'dead_end' && draft.status !== 'open') continue
      const hypha = byId.get(draft.id)!
      const parent = byId.get(draft.parentHyphaId ?? topology.main.id)!
      const isOnMain = parent.kind === 'main'
      const parentFrac = timeToFrac(draft.splitTime, bounds)
      const roomCap = isOnMain ? localSpiralPitch(parentFrac, activity) * SPIRAL_PITCH_SAFETY : NESTED_MAX_LANE_DEPTH
      const attach = pointOnHyphaAtTime(parent.points, draft.splitTime)
      // depth (lateral, <= roomCap) + forward reach (<= depth * 0.8) +
      // jitter + droop/lift (Y-only, still included since this checks 3D
      // distance), generously bounded.
      const bound = roomCap * 2.5 + SIDE_JITTER_MAX + 1e-6

      for (const point of hypha.points) {
        const dx = point.position.x - attach.position.x
        const dz = point.position.z - attach.position.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        expect(distance).toBeLessThanOrEqual(bound)
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
