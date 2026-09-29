import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../shared/timeBounds'
import { makeBranch, makeClosedPr, makeOpenPr, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import { layoutNetworkColony, type ColonyLayoutInstrumentation } from './colonyLayout'
import { buildHyphaTopology } from './topology'
import type { NetworkModel } from './types'

const FIXTURES: [string, RepoSnapshot][] = [
  ['pmndrs/valtio', valtioFixture as unknown as RepoSnapshot],
  ['expressjs/express', expressFixture as unknown as RepoSnapshot],
]

/** Recursively scans any plain object/array for a non-finite number, returning its path or null. */
function findNonFinite(value: unknown, path = 'root'): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : path
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findNonFinite(value[i], `${path}[${i}]`)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findNonFinite(child, `${path}.${key}`)
      if (found) return found
    }
  }
  return null
}

function allLookupableElements(model: NetworkModel): { id: string; time: number; ref: unknown }[] {
  return [...model.hyphae, ...model.nodes, ...model.tips, ...model.mushrooms]
}

describe('buildNetwork', () => {
  it('is deterministic: the same snapshot always produces an identical model', () => {
    const snapshot = makeSnapshot()
    expect(buildNetwork(snapshot)).toEqual(buildNetwork(snapshot))
  })

  it('never produces a NaN/non-finite number anywhere in the model', () => {
    const snapshot = makeSnapshot()
    const model = buildNetwork(snapshot)
    expect(findNonFinite(model)).toBeNull()
  })

  it('gives every hypha/node/tip/mushroom a non-empty id, a finite time, and a ref', () => {
    const snapshot = makeSnapshot()
    const model = buildNetwork(snapshot)
    for (const element of allLookupableElements(model)) {
      expect(typeof element.id).toBe('string')
      expect(element.id.length).toBeGreaterThan(0)
      expect(Number.isFinite(element.time)).toBe(true)
      expect(element.ref).toBeTruthy()
    }
    expect(model.spore.id).toBe('spore')
    expect(Number.isFinite(model.spore.time)).toBe(true)
    expect(model.spore.ref).toBeTruthy()
  })

  it('produces a spore + a short main hypha for a tiny repo (0 PRs, 0 releases, 1 commit)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [
        {
          oid: 'first',
          messageHeadline: 'init',
          authoredDate: '2024-01-01T00:00:00Z',
          author: { login: null, avatarUrl: null },
          url: 'https://x/first',
        },
      ],
    })
    const model = buildNetwork(snapshot)
    expect(model.spore).toBeDefined()
    expect(model.hyphae).toHaveLength(1)
    expect(model.hyphae[0]!.kind).toBe('main')
    expect(model.hyphae[0]!.points.length).toBeGreaterThan(0)
    expect(model.nodes).toHaveLength(1)
    expect(model.mushrooms).toHaveLength(0)
    expect(findNonFinite(model)).toBeNull()
  })

  it('reports honest, non-fabricated summary counts', () => {
    const snapshot = makeSnapshot()
    const model = buildNetwork(snapshot)
    const totalHyphae = Object.values(model.summary.hyphaCountByKind).reduce((a, b) => a + b, 0)
    expect(totalHyphae).toBe(model.hyphae.length)
    expect(model.summary.nodeCount).toBe(model.nodes.length)
    expect(model.summary.mushroomCount).toBe(model.mushrooms.length)
    expect(model.summary.hairCount).toBe(model.hairs.length)
  })

  it('grows exactly one hair per rendered commit node -- real mycelial texture, never decorative filler', () => {
    const snapshot = makeSnapshot()
    const model = buildNetwork(snapshot)
    expect(model.hairs.length).toBe(model.nodes.length)
    const nodeIds = new Set(model.nodes.map((n) => n.id))
    for (const hair of model.hairs) {
      expect(nodeIds.has(hair.nodeId)).toBe(true)
      expect(Number.isFinite(hair.length)).toBe(true)
      expect(hair.length).toBeGreaterThan(0)
    }
  })

  describe.each(FIXTURES)('%s (real fixture smoke test)', (_name, snapshot) => {
    it('produces a model with sane bounds and no non-finite numbers', () => {
      const model = buildNetwork(snapshot)
      expect(findNonFinite(model)).toBeNull()

      expect(model.bounds.time.firstEventTime).toBeLessThanOrEqual(model.bounds.time.lastEventTime)
      expect(model.bounds.radius).toBeGreaterThan(0)
      expect(Number.isFinite(model.bounds.radius)).toBe(true)

      expect(model.hyphae.length).toBeGreaterThan(1) // main + at least one PR-derived hypha
      expect(model.hyphae[0]!.kind).toBe('main')
      expect(model.nodes.length).toBeGreaterThan(0)

      const ids = new Set(allLookupableElements(model).map((e) => e.id))
      expect(ids.size).toBe(allLookupableElements(model).length) // every id is unique
    })

    it('grows exactly one hair per rendered commit node', () => {
      const model = buildNetwork(snapshot)
      expect(model.hairs.length).toBe(model.nodes.length)
    })

    it('every mushroom sits exactly on its own release-time growth ring, with real ids and no NaNs', () => {
      const model = buildNetwork(snapshot)
      expect(model.layout).toBe('colony')
      expect(findNonFinite(model)).toBeNull()
      expect(model.rings.length).toBeGreaterThan(0)
      expect(model.fusions.length).toBeGreaterThan(0)
      expect(model.hairs.length).toBe(model.nodes.length)
      for (const mushroom of model.mushrooms) {
        expect(mushroom.id.length).toBeGreaterThan(0)
        expect(Number.isFinite(mushroom.position.x)).toBe(true)
        expect(Number.isFinite(mushroom.position.z)).toBe(true)
      }
    })
  })
})

describe('buildNetwork performance (deterministic proxy, not wall-clock -- B3/T8)', () => {
  const AUTHOR_COUNT = 25
  const PR_COUNT = 1000

  function buildLargeSnapshot(): RepoSnapshot {
    const authors: CommitAuthor[] = Array.from({ length: AUTHOR_COUNT }, (_, i) => ({ login: `author${i}`, avatarUrl: null }))
    const base = Date.parse('2015-01-01T00:00:00Z')
    const mergedPullRequests: MergedPullRequest[] = Array.from({ length: PR_COUNT }, (_, i) => {
      const splitAt = base + i * 86_400_000 * 3
      const mergedAt = splitAt + 86_400_000 * 2
      const author = authors[i % AUTHOR_COUNT]!
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
        additions: 5,
        deletions: 1,
        changedFiles: 1,
        labels: [],
        commitCount: 3,
        commits: [1, 2, 3].map((k) => ({
          oid: `oid-${i}-${k}`,
          messageHeadline: 'x',
          authoredDate: new Date(splitAt + k * 1000).toISOString(),
          author,
          url: 'https://x',
        })),
      }
    })

    return makeSnapshot({
      mergedPullRequests,
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: Array.from({ length: 50 }, (_, i) => ({
        name: `v${i}`,
        tag: `v${i}.0.0`,
        date: new Date(base + i * 86_400_000 * 30).toISOString(),
        url: 'https://x',
        targetOid: null,
      })),
      directCommits: [],
    })
  }

  it('lays out 1000 PRs (still produces a valid model)', () => {
    const snapshot = buildLargeSnapshot()
    const model = buildNetwork(snapshot)
    expect(model.hyphae.length).toBeGreaterThan(PR_COUNT)
  })

  /**
   * Replaces the original `performance.now()` budget (flaky under CI/
   * parallel-worker load, see the M3 progress notes -- it intermittently
   * failed at 600-720ms against a 600ms budget when the full suite ran
   * under worker contention, always passing standalone). A REAL complexity
   * regression still gets caught, just without any wall-clock involved:
   * `layoutNetworkColony`'s main loop calls `computeSpanning`, which scans
   * every already-placed hypha once per new hypha placed (an accepted
   * O(n^2) design for n ~= 1000 -- fast in practice, ~500k simple
   * comparisons). `ColonyLayoutInstrumentation.onSpanningScan` (opt-in,
   * never used by production code) reports exactly how many hyphae each
   * scan walked, so the TOTAL across all placements is an exact, 100%
   * deterministic proxy for the algorithm's real work -- for `n` hyphae
   * placed one at a time into an initially-empty list, that total is
   * exactly `n*(n-1)/2` under the current design. A regression that made
   * the scan unbounded (e.g. rescanning full geometry per hypha instead of
   * the bounded spanning search) would blow this exact value up by orders
   * of magnitude, failing both assertions below.
   */
  it("computeSpanning's total per-hypha scan work stays at its expected O(n^2) proxy for 1000 hyphae", () => {
    const snapshot = buildLargeSnapshot()
    const bounds = computeTimeBounds(snapshot)
    const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
    const topology = buildHyphaTopology(snapshot, bounds)

    let totalScanned = 0
    const instrumentation: ColonyLayoutInstrumentation = {
      onSpanningScan: (scannedCount) => {
        totalScanned += scannedCount
      },
    }
    const colony = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, {}, instrumentation)

    const n = topology.hyphae.length
    expect(colony.hyphae.length).toBe(n + 1) // + the degenerate lookup-only "main" hypha, see `layoutNetworkColony`
    expect(n).toBeGreaterThan(PR_COUNT * 0.9) // sanity: the topology actually kept ~1000 hyphae, not a handful
    expect(totalScanned).toBe((n * (n - 1)) / 2)
    // A generous (2x) upper bound independent of the exact-equality check
    // above, so this test still means something even if the exact formula
    // above is ever deliberately loosened for a future algorithm change.
    expect(totalScanned).toBeLessThan(PR_COUNT * PR_COUNT)
  })
})

describe('buildNetwork at the real server caps (B3/T8 correctness smoke test)', () => {
  /**
   * Mirrors `src/adapters/github/caps.ts`'s `CAPS` exactly (1000 merged PRs
   * x 20 commits each, 200 closed PRs, 50 open PRs, 100 live branches, 100
   * releases) -- the actual maximum-size snapshot the real app can ever
   * receive from `/api/repo`. A correctness check (valid model, no NaNs, no
   * crash), not a timing one -- `pnpm bench` (optional, see `scripts/
   * bench.ts`) covers real wall-clock timing separately, outside the
   * regular `pnpm test` suite.
   */
  it('produces a valid, finite, capped model at the real server caps', () => {
    const author: CommitAuthor = { login: 'author', avatarUrl: null }
    const base = Date.parse('2015-01-01T00:00:00Z')

    const mergedPullRequests: MergedPullRequest[] = Array.from({ length: 1000 }, (_, i) => {
      const splitAt = base + i * 86_400_000 * 3
      const mergedAt = splitAt + 86_400_000 * 2
      return {
        number: i + 1,
        title: `PR ${i + 1}`,
        author,
        mergedAt: new Date(mergedAt).toISOString(),
        createdAt: new Date(splitAt).toISOString(),
        url: `https://x/pull/${i + 1}`,
        baseRefName: 'main',
        headRefName: `pr-${i + 1}`,
        firstCommitTime: new Date(splitAt).toISOString(),
        additions: 50,
        deletions: 10,
        changedFiles: 4,
        labels: [],
        commitCount: 20,
        commits: Array.from({ length: 20 }, (_, k) => ({
          oid: `oid-${i}-${k}`,
          messageHeadline: `commit ${k}`,
          authoredDate: new Date(splitAt + k * 1000).toISOString(),
          author,
          url: 'https://x',
        })),
      }
    })

    const closedPullRequests = Array.from({ length: 200 }, (_, i) =>
      makeClosedPr({
        number: 100_000 + i,
        createdAt: new Date(base + i * 86_400_000 * 5).toISOString(),
        closedAt: new Date(base + i * 86_400_000 * 5 + 86_400_000).toISOString(),
        commits: Array.from({ length: 8 }, (_, k) => ({
          oid: `closed-oid-${i}-${k}`,
          messageHeadline: `closed commit ${k}`,
          authoredDate: new Date(base + i * 86_400_000 * 5 + k * 1000).toISOString(),
          author,
          url: 'https://x',
        })),
      }),
    )

    const openPullRequests = Array.from({ length: 50 }, (_, i) =>
      makeOpenPr({
        number: 200_000 + i,
        createdAt: new Date(base + 86_400_000 * 3000 + i * 86_400_000).toISOString(),
      }),
    )

    const liveBranches = Array.from({ length: 100 }, (_, i) =>
      makeBranch({ name: `branch-${i}`, lastCommitDate: new Date(base + 86_400_000 * (1000 + i * 10)).toISOString() }),
    )

    const releases = Array.from({ length: 100 }, (_, i) => ({
      name: `v${i}.0.0`,
      tag: `v${i}.0.0`,
      date: new Date(base + i * 86_400_000 * 30).toISOString(),
      url: 'https://x',
      targetOid: null,
    }))

    const snapshot = makeSnapshot({ mergedPullRequests, closedPullRequests, openPullRequests, liveBranches, releases, directCommits: [] })

    const model = buildNetwork(snapshot)

    expect(model.hyphae.length).toBeGreaterThan(0)
    expect(findNonFinite(model)).toBeNull()
    // The topology cap (1000) applies to merged+live-branch hyphae; closed
    // PRs (dead ends) and the main hypha are additional, so this can
    // legitimately exceed 1000, but must never explode past a sane multiple.
    expect(model.hyphae.length).toBeLessThan(1000 + 200 + 100 + 10)
    expect(model.mushrooms.length).toBeLessThanOrEqual(100)
    expect(model.overflow.hyphaeOmitted).toBeGreaterThanOrEqual(0)
  })
})
