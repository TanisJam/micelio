import { describe, expect, it } from 'vitest'
import { computeTimeBounds } from '../shared/timeBounds'
import { makeBranch, makeClosedPr, makeMergedPr, makeOpenPr, makeSnapshot } from '../shared/testHelpers'
import { buildHyphaTopology } from './topology'

describe('buildHyphaTopology', () => {
  it('is deterministic: the same snapshot always produces an identical topology', () => {
    const snapshot = makeSnapshot()
    const bounds = computeTimeBounds(snapshot)
    const a = buildHyphaTopology(snapshot, bounds)
    const b = buildHyphaTopology(snapshot, bounds)
    expect(a).toEqual(b)
  })

  it('parents a PR based on the default branch directly to main', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [makeMergedPr({ baseRefName: 'main', headRefName: 'feature-a' })],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    expect(hyphae).toHaveLength(1)
    expect(hyphae[0]!.parentHyphaId).toBe('hypha-main')
  })

  it('nests a PR whose base ref matches an earlier PR headRef (branch-from-branch)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [
        makeMergedPr({
          number: 1,
          baseRefName: 'main',
          headRefName: 'feature-x',
          createdAt: '2021-01-01T00:00:00Z',
          firstCommitTime: '2021-01-01T00:00:00Z',
          mergedAt: '2021-03-01T00:00:00Z',
        }),
        makeMergedPr({
          number: 2,
          baseRefName: 'feature-x',
          headRefName: 'feature-x-followup',
          createdAt: '2021-02-01T00:00:00Z',
          firstCommitTime: '2021-02-01T00:00:00Z',
          mergedAt: '2021-02-15T00:00:00Z',
        }),
      ],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    const child = hyphae.find((h) => h.id === 'hypha-pr2')!
    expect(child.parentHyphaId).toBe('hypha-pr1')
  })

  it('falls back to main when the base ref never existed as an earlier headRef (not time-consistent)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [
        // References a branch name that was only introduced LATER (PR 2 head
        // postdates PR 1's split) -- not a valid, time-consistent parent.
        makeMergedPr({
          number: 1,
          baseRefName: 'not-yet-created',
          headRefName: 'pr-1-branch',
          createdAt: '2021-01-01T00:00:00Z',
          firstCommitTime: '2021-01-01T00:00:00Z',
          mergedAt: '2021-01-05T00:00:00Z',
        }),
        makeMergedPr({
          number: 2,
          baseRefName: 'main',
          headRefName: 'not-yet-created',
          createdAt: '2021-02-01T00:00:00Z',
          firstCommitTime: '2021-02-01T00:00:00Z',
          mergedAt: '2021-02-05T00:00:00Z',
        }),
      ],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    const first = hyphae.find((h) => h.id === 'hypha-pr1')!
    expect(first.parentHyphaId).toBe('hypha-main')
  })

  it('marks a closed-unmerged PR as a dead end and an open PR as open', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      closedPullRequests: [makeClosedPr({ number: 10 })],
      openPullRequests: [makeOpenPr({ number: 11 })],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    const closed = hyphae.find((h) => h.id === 'hypha-pr10')!
    const open = hyphae.find((h) => h.id === 'hypha-pr11')!
    expect(closed.kind).toBe('closed')
    expect(closed.status).toBe('dead_end')
    expect(open.kind).toBe('open')
    expect(open.status).toBe('open')
    expect(open.endTime).toBe(bounds.lastEventTime)
  })

  it('every hypha (main and PR-derived) has splitTime <= endTime', () => {
    // Includes a real-world data-quality edge case: a merged PR whose
    // computed `firstCommitTime` (min authored/committed across its capped
    // commits) lands AFTER its own `mergedAt` -- observed in the wild in
    // `expressjs/express` (PR #821, an old 2011-era commit with a
    // committedDate later than the merge event). The topology must clamp
    // rather than produce a negative-duration hypha.
    const snapshot = makeSnapshot({
      mergedPullRequests: [
        makeMergedPr({ number: 1 }),
        makeMergedPr({
          number: 2,
          createdAt: '2020-01-01T00:00:00Z',
          firstCommitTime: '2020-06-01T00:00:00Z',
          mergedAt: '2020-01-02T00:00:00Z',
        }),
      ],
      closedPullRequests: [makeClosedPr({ number: 3 })],
      openPullRequests: [makeOpenPr({ number: 4 })],
    })
    const bounds = computeTimeBounds(snapshot)
    const { main, hyphae } = buildHyphaTopology(snapshot, bounds)
    for (const hypha of [main, ...hyphae]) {
      expect(hypha.splitTime).toBeLessThanOrEqual(hypha.endTime)
    }
    for (const hypha of [main, ...hyphae]) {
      for (const commit of hypha.commits) {
        expect(commit.time).toBeGreaterThanOrEqual(hypha.splitTime)
        expect(commit.time).toBeLessThanOrEqual(hypha.endTime)
      }
    }
  })

  it('clamps a child split time to be >= its parent start (never predates the parent)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [
        makeMergedPr({
          number: 1,
          baseRefName: 'main',
          // Deliberately earlier than the repo's own createdAt / first event time.
          firstCommitTime: '1999-01-01T00:00:00Z',
          createdAt: '1999-01-01T00:00:00Z',
          mergedAt: '2020-01-01T00:00:00Z',
        }),
      ],
    })
    const bounds = computeTimeBounds(snapshot)
    const { main, hyphae } = buildHyphaTopology(snapshot, bounds)
    const pr = hyphae.find((h) => h.id === 'hypha-pr1')!
    expect(pr.splitTime).toBeGreaterThanOrEqual(main.splitTime)
  })

  it('adds a live-branch hypha for a branch with no matching PR headRef, parented to main', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      liveBranches: [makeBranch({ name: 'stray-branch', lastCommitDate: '2023-06-01T00:00:00Z' })],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    const branchHypha = hyphae.find((h) => h.kind === 'liveBranch')!
    expect(branchHypha).toBeDefined()
    expect(branchHypha.parentHyphaId).toBe('hypha-main')
    expect(branchHypha.status).toBe('open')
  })

  it('does not duplicate a live branch that already has a matching open PR', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [makeOpenPr({ number: 5, headRefName: 'wip-branch' })],
      liveBranches: [makeBranch({ name: 'wip-branch' })],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    expect(hyphae.filter((h) => h.kind === 'liveBranch')).toHaveLength(0)
    expect(hyphae).toHaveLength(1)
  })

  it('excludes the default branch itself from live-branch hyphae', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      liveBranches: [makeBranch({ name: 'main' })],
    })
    const bounds = computeTimeBounds(snapshot)
    const { hyphae } = buildHyphaTopology(snapshot, bounds)
    expect(hyphae).toHaveLength(0)
  })

  it('caps total hyphae, honestly recording overflow, and never leaves a dangling parent reference', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeMergedPr({
        number: i + 1,
        baseRefName: 'main',
        headRefName: `pr-${i + 1}`,
        createdAt: new Date(2020, 0, i + 1).toISOString(),
        firstCommitTime: new Date(2020, 0, i + 1).toISOString(),
        mergedAt: new Date(2020, 0, i + 2).toISOString(),
      }),
    )
    const snapshot = makeSnapshot({ mergedPullRequests: many, openPullRequests: [], closedPullRequests: [], liveBranches: [] })
    const bounds = computeTimeBounds(snapshot)
    const { main, hyphae, hyphaeOmitted } = buildHyphaTopology(snapshot, bounds, { maxHyphae: 5 })
    expect(hyphae).toHaveLength(5)
    expect(hyphaeOmitted).toBe(7)
    const keptIds = new Set([main.id, ...hyphae.map((h) => h.id)])
    for (const hypha of hyphae) {
      expect(hypha.parentHyphaId === null || keptIds.has(hypha.parentHyphaId)).toBe(true)
    }
  })

  it('produces just a main hypha (no PR-derived hyphae) for a tiny repo with no PRs/releases and one commit', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [{ oid: 'only1', messageHeadline: 'init', authoredDate: '2024-01-01T00:00:00Z', author: { login: null, avatarUrl: null }, url: 'https://x/only1' }],
    })
    const bounds = computeTimeBounds(snapshot)
    const { main, hyphae } = buildHyphaTopology(snapshot, bounds)
    expect(hyphae).toHaveLength(0)
    expect(main.kind).toBe('main')
    expect(main.splitTime).toBeLessThanOrEqual(main.endTime)
    expect(main.commits).toHaveLength(1)
  })
})
