import { describe, expect, it } from 'vitest'
import { makeDirectCommit, makeMergedPr, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import { buildNetworkExploreGroups } from './exploreGroups'

describe('buildNetworkExploreGroups', () => {
  it('groups PR hyphae by the UTC year of their real resolved date, ascending', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [
        makeMergedPr({
          number: 1,
          baseRefName: 'main',
          headRefName: 'a',
          createdAt: '2020-01-01T00:00:00Z',
          firstCommitTime: '2020-01-01T00:00:00Z',
          mergedAt: '2020-02-01T00:00:00Z',
        }),
        makeMergedPr({
          number: 2,
          baseRefName: 'main',
          headRefName: 'b',
          createdAt: '2022-01-01T00:00:00Z',
          firstCommitTime: '2022-01-01T00:00:00Z',
          mergedAt: '2022-02-01T00:00:00Z',
        }),
      ],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
    })
    const model = buildNetwork(snapshot)
    const groups = buildNetworkExploreGroups(model, snapshot)

    expect(groups.map((g) => g.year)).toEqual([2020, 2022])
    expect(groups[0]!.pullRequests).toHaveLength(1)
    expect(groups[0]!.pullRequests[0]!.number).toBe(1)
    expect(groups[0]!.pullRequests[0]!.status).toBe('merged')
    expect(groups[0]!.pullRequests[0]!.title.length).toBeGreaterThan(0)
  })

  it('lists real commits under each PR entry, with a headline resolved from the snapshot', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'a' })],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
    })
    const model = buildNetwork(snapshot)
    const groups = buildNetworkExploreGroups(model, snapshot)
    const pr = groups[0]!.pullRequests[0]!
    expect(pr.commits.length).toBeGreaterThan(0)
    for (const commit of pr.commits) {
      expect(commit.headline.length).toBeGreaterThan(0)
      expect(commit.id.length).toBeGreaterThan(0)
    }
  })

  it('never includes the main hypha or mushrooms as a "pull request" row', () => {
    const snapshot = makeSnapshot()
    const model = buildNetwork(snapshot)
    const groups = buildNetworkExploreGroups(model, snapshot)
    const allIds = groups.flatMap((g) => g.pullRequests.map((pr) => pr.id))
    expect(allIds).not.toContain(model.hyphae.find((h) => h.kind === 'main')!.id)
  })

  it('lists a direct-commit burst as its own row (Unit 2), with a null PR number and its real commits', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [makeDirectCommit({ oid: 'd1', authoredDate: '2021-05-01T00:00:00Z', author: { login: 'alice', avatarUrl: null } })],
    })
    const model = buildNetwork(snapshot)
    const groups = buildNetworkExploreGroups(model, snapshot)
    expect(groups).toHaveLength(1)
    const entry = groups[0]!.pullRequests[0]!
    expect(entry.number).toBeNull()
    expect(entry.status).toBe('direct')
    expect(entry.commits).toHaveLength(1)
    expect(entry.commits[0]!.headline.length).toBeGreaterThan(0)
  })
})
