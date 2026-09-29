import { describe, expect, it } from 'vitest'
import { summarizeElementDetail, type ElementDetail } from './elementDetail'

const AUTHOR = { login: 'octocat', avatarUrl: null }

describe('summarizeElementDetail', () => {
  it('summarizes the repo overview', () => {
    const detail: ElementDetail = {
      kind: 'repo',
      id: 'trunk',
      owner: 'octo-org',
      name: 'octo-repo',
      description: null,
      url: 'https://github.com/octo-org/octo-repo',
      stars: 1,
      forks: 1,
      createdAt: 1000,
      defaultBranch: 'main',
    }
    const summary = summarizeElementDetail(detail)
    expect(summary.kindLabel).toBe('Repository')
    expect(summary.title).toBe('octo-org/octo-repo')
    expect(summary.date).toBe(1000)
  })

  it('summarizes a merged pull request with its number and title', () => {
    const detail: ElementDetail = {
      kind: 'pull_request',
      id: 'hypha-pr1',
      status: 'merged',
      number: 42,
      title: 'Add feature',
      url: 'https://x/pull/42',
      author: AUTHOR,
      date: 5000,
      additions: 10,
      deletions: 2,
      changedFiles: 1,
      labels: [],
      commitCount: 3,
      commits: [],
    }
    const summary = summarizeElementDetail(detail)
    expect(summary.kindLabel).toBe('Merged pull request')
    expect(summary.title).toContain('#42')
    expect(summary.date).toBe(5000)
  })

  it('labels a closed and an open pull request distinctly', () => {
    const base: Omit<Extract<ElementDetail, { kind: 'pull_request' }>, 'status'> = {
      kind: 'pull_request',
      id: 'hypha-pr2',
      number: 2,
      title: 'x',
      url: 'https://x',
      author: AUTHOR,
      date: 0,
      additions: null,
      deletions: null,
      changedFiles: null,
      labels: [],
      commitCount: null,
      commits: [],
    }
    expect(summarizeElementDetail({ ...base, status: 'closed' }).kindLabel).toBe('Closed pull request')
    expect(summarizeElementDetail({ ...base, status: 'open' }).kindLabel).toBe('Open pull request')
  })

  it('summarizes a commit, a release and a branch', () => {
    const commit = summarizeElementDetail({
      kind: 'commit',
      id: 'node-1',
      oid: 'abc123',
      headline: 'fix bug',
      date: 10,
      author: AUTHOR,
      url: 'https://x',
      parentPr: null,
    })
    expect(commit).toEqual({ kindLabel: 'Commit', title: 'fix bug', date: 10 })

    const release = summarizeElementDetail({
      kind: 'release',
      id: 'mushroom-v1.0.0',
      name: 'v1.0.0',
      tag: 'v1.0.0',
      date: 20,
      url: 'https://x',
    })
    expect(release).toEqual({ kindLabel: 'Release', title: 'v1.0.0', date: 20 })

    const branch = summarizeElementDetail({
      kind: 'branch',
      id: 'hypha-feature-x',
      name: 'feature/x',
      lastCommitDate: 30,
      url: 'https://x',
    })
    expect(branch).toEqual({ kindLabel: 'Branch', title: 'feature/x', date: 30 })
  })
})
