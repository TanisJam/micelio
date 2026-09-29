import { describe, expect, it } from 'vitest'
import { makeBranch, makeClosedPr, makeDirectCommit, makeMergedPr, makeOpenPr, makeRelease, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import { resolveNetworkElementDetail } from './elementDetail'

function buildFixtureModel() {
  const snapshot = makeSnapshot({
    mergedPullRequests: [makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'feature-1' })],
    closedPullRequests: [makeClosedPr({ number: 2, baseRefName: 'main', headRefName: 'feature-2' })],
    openPullRequests: [makeOpenPr({ number: 3, baseRefName: 'main', headRefName: 'feature-3' })],
    liveBranches: [makeBranch({ name: 'stray-branch', lastCommitDate: '2023-01-01T00:00:00Z' })],
    releases: [makeRelease({ tag: 'v1.0.0', date: '2022-01-01T00:00:00Z' })],
  })
  const model = buildNetwork(snapshot)
  return { snapshot, model }
}

describe('resolveNetworkElementDetail', () => {
  it('resolves the spore to a repo overview detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const detail = resolveNetworkElementDetail(model, snapshot, 'spore')
    expect(detail).toMatchObject({ kind: 'repo', owner: snapshot.meta.owner, name: snapshot.meta.name })
  })

  it('returns null for an unknown id', () => {
    const { snapshot, model } = buildFixtureModel()
    expect(resolveNetworkElementDetail(model, snapshot, 'nope')).toBeNull()
  })

  it('resolves the main hypha to a branch detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const main = model.hyphae.find((h) => h.kind === 'main')!
    const detail = resolveNetworkElementDetail(model, snapshot, main.id)
    expect(detail).toMatchObject({ kind: 'branch', name: snapshot.meta.defaultBranch })
  })

  it('resolves a merged-PR hypha to a "merged" pull request detail with real fields', () => {
    const { snapshot, model } = buildFixtureModel()
    const hypha = model.hyphae.find((h) => h.kind === 'merged')!
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    expect(detail).toMatchObject({ kind: 'pull_request', status: 'merged', number: 1 })
  })

  it('resolves a closed-PR hypha to a "closed" pull request detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const hypha = model.hyphae.find((h) => h.kind === 'closed')!
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    expect(detail).toMatchObject({ kind: 'pull_request', status: 'closed', number: 2 })
    if (detail?.kind === 'pull_request') {
      expect(detail.additions).toBeNull()
      expect(detail.labels).toEqual([])
    }
  })

  it('resolves an open-PR hypha to an "open" pull request detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const hypha = model.hyphae.find((h) => h.kind === 'open')!
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    expect(detail).toMatchObject({ kind: 'pull_request', status: 'open', number: 3 })
  })

  it('resolves a live-branch hypha to a branch detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const hypha = model.hyphae.find((h) => h.kind === 'liveBranch')!
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    expect(detail).toMatchObject({ kind: 'branch', name: 'stray-branch' })
  })

  it('resolves a commit node to a commit detail with a link back to its PR', () => {
    const { snapshot, model } = buildFixtureModel()
    const node = model.nodes.find((n) => n.ref.type === 'commit' && !n.isMergePoint)!
    const detail = resolveNetworkElementDetail(model, snapshot, node.id)
    expect(detail?.kind).toBe('commit')
    if (detail?.kind === 'commit') {
      expect(detail.oid).toBe(node.ref.id)
    }
  })

  // The colony layout represents a merge as a `Fusion` knot on the PR's OWN
  // hypha (see `types.ts`'s `Fusion` doc), never as a separate node on
  // `main` -- `main` never carries commit nodes of its own at all (Unit 2:
  // direct commits render via their own `direct`-kind hyphae, merge points
  // exist only as `main.commits` pseudo-entries at the topology level, never
  // rendered as nodes), so `model.nodes.find((n) => n.isMergePoint)` is
  // always empty for colony
  // and a fusion itself isn't independently selectable
  // (`LookupableNetworkElement` excludes `Fusion`). The merged PR is still
  // fully resolvable through its own hypha id, covered above.
  it('never renders a merge-point node on main (represented by a fusion knot on the PR`s own hypha instead)', () => {
    const { model } = buildFixtureModel()
    expect(model.nodes.some((n) => n.isMergePoint)).toBe(false)
    expect(model.fusions.length).toBeGreaterThan(0)
  })

  it('resolves a mushroom to a release detail', () => {
    const { snapshot, model } = buildFixtureModel()
    const mushroom = model.mushrooms[0]!
    const detail = resolveNetworkElementDetail(model, snapshot, mushroom.id)
    expect(detail).toMatchObject({ kind: 'release', tag: 'v1.0.0' })
  })

  it('resolves an open-PR tip to the same pull request detail as its hypha', () => {
    const { snapshot, model } = buildFixtureModel()
    const tip = model.tips.find((t) => t.ref.type === 'pull_request')!
    const detail = resolveNetworkElementDetail(model, snapshot, tip.id)
    expect(detail).toMatchObject({ kind: 'pull_request', status: 'open', number: 3 })
  })

  describe('direct-commit bursts (Unit 2)', () => {
    function buildDirectBurstModel() {
      const base = Date.parse('2024-03-01T00:00:00Z')
      const oneHourMs = 60 * 60 * 1000
      const commits = [
        makeDirectCommit({ oid: 'd1', authoredDate: new Date(base).toISOString(), author: { login: 'alice', avatarUrl: null }, additions: 10, deletions: 2 }),
        makeDirectCommit({ oid: 'd2', authoredDate: new Date(base + oneHourMs).toISOString(), author: { login: 'alice', avatarUrl: null }, additions: 5, deletions: 1 }),
      ]
      const snapshot = makeSnapshot({
        mergedPullRequests: [],
        openPullRequests: [],
        closedPullRequests: [],
        liveBranches: [],
        releases: [],
        directCommits: commits,
      })
      const model = buildNetwork(snapshot)
      return { snapshot, model }
    }

    it('resolves a `direct` hypha to a direct-burst detail with the real author, commit count, date range and summed changes', () => {
      const { snapshot, model } = buildDirectBurstModel()
      const hypha = model.hyphae.find((h) => h.kind === 'direct')!
      const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
      expect(detail).toMatchObject({
        kind: 'direct_burst',
        defaultBranch: snapshot.meta.defaultBranch,
        author: { login: 'alice', avatarUrl: null },
        commitCount: 2,
        additions: 15,
        deletions: 3,
      })
      if (detail?.kind === 'direct_burst') {
        expect(detail.firstDate).toBeLessThanOrEqual(detail.lastDate)
        expect(detail.commits.map((c) => c.oid)).toEqual(['d1', 'd2'])
        expect(detail.commits.every((c) => c.elementId !== null)).toBe(true)
      }
    })

    it('resolves a direct-burst commit node to a commit detail (no parent PR)', () => {
      const { snapshot, model } = buildDirectBurstModel()
      const node = model.nodes.find((n) => n.ref.type === 'commit')!
      const detail = resolveNetworkElementDetail(model, snapshot, node.id)
      expect(detail?.kind).toBe('commit')
      if (detail?.kind === 'commit') {
        expect(detail.parentPr).toBeNull()
      }
    })
  })
})
