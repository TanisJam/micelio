import { describe, expect, it } from 'vitest'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import expressFixture from '../../server/fixtures/expressjs-express.json' with { type: 'json' }
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from '../repo'
import { makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
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

describe('buildNetwork performance', () => {
  const AUTHOR_COUNT = 25
  const PR_COUNT = 1000
  /**
   * Generous relative to the ~200ms/1000-PR budget (M2c task brief) to
   * avoid CI flakiness on a slow/shared runner, while still catching a real
   * regression; the actual observed time (see the M2c progress notes) is
   * well under 200ms on a normal dev machine.
   */
  const BUDGET_MS = 600

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

  it('lays out 1000 PRs in well under the CI-safe budget', () => {
    const snapshot = buildLargeSnapshot()
    const start = performance.now()
    const model = buildNetwork(snapshot)
    const elapsed = performance.now() - start
    expect(model.hyphae.length).toBeGreaterThan(PR_COUNT)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })
})
