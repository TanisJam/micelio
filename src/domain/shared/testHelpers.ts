import type {
  ClosedPullRequest,
  CommitAuthor,
  DirectCommit,
  LiveBranch,
  MergedPullRequest,
  OpenPullRequest,
  PrCommit,
  ReleaseInfo,
  RepoSnapshot,
} from '../repo'

/** Test-only builders for synthetic `RepoSnapshot`s. Not used by app code. */

const AUTHOR: CommitAuthor = { login: 'octocat', avatarUrl: null }

let commitCounter = 0

export function makeCommit(overrides: Partial<PrCommit> = {}): PrCommit {
  commitCounter += 1
  return {
    oid: `oid-${commitCounter}`,
    messageHeadline: `commit ${commitCounter}`,
    authoredDate: '2023-01-01T00:00:00Z',
    author: AUTHOR,
    url: `https://github.com/o/r/commit/oid-${commitCounter}`,
    ...overrides,
  }
}

let prCounter = 0

export function makeMergedPr(overrides: Partial<MergedPullRequest> = {}): MergedPullRequest {
  prCounter += 1
  const commits = overrides.commits ?? [makeCommit({ authoredDate: overrides.mergedAt ?? '2023-01-01T00:00:00Z' })]
  return {
    number: prCounter,
    title: `PR ${prCounter}`,
    author: AUTHOR,
    mergedAt: '2023-01-01T00:00:00Z',
    createdAt: '2022-12-30T00:00:00Z',
    url: `https://github.com/o/r/pull/${prCounter}`,
    baseRefName: 'main',
    headRefName: `pr-${prCounter}`,
    firstCommitTime: overrides.createdAt ?? '2022-12-30T00:00:00Z',
    additions: 5,
    deletions: 1,
    changedFiles: 1,
    labels: [],
    commitCount: commits.length,
    ...overrides,
    commits,
  }
}

export function makeClosedPr(overrides: Partial<ClosedPullRequest> = {}): ClosedPullRequest {
  prCounter += 1
  const commits = overrides.commits ?? [makeCommit({ authoredDate: overrides.createdAt ?? '2023-01-01T00:00:00Z' })]
  return {
    number: prCounter,
    title: `Closed PR ${prCounter}`,
    author: AUTHOR,
    createdAt: '2023-01-01T00:00:00Z',
    closedAt: '2023-01-05T00:00:00Z',
    url: `https://github.com/o/r/pull/${prCounter}`,
    baseRefName: 'main',
    headRefName: `closed-pr-${prCounter}`,
    firstCommitTime: overrides.createdAt ?? '2023-01-01T00:00:00Z',
    commitCount: commits.length,
    ...overrides,
    commits,
  }
}

export function makeOpenPr(overrides: Partial<OpenPullRequest> = {}): OpenPullRequest {
  const commits = overrides.commits ?? [makeCommit({ authoredDate: overrides.createdAt ?? '2024-01-01T00:00:00Z' })]
  return {
    number: 9001,
    title: 'wip',
    author: AUTHOR,
    createdAt: '2024-01-01T00:00:00Z',
    url: 'https://github.com/o/r/pull/9001',
    baseRefName: 'main',
    headRefName: 'wip-branch',
    firstCommitTime: overrides.createdAt ?? '2024-01-01T00:00:00Z',
    commitCount: commits.length,
    ...overrides,
    commits,
  }
}

export function makeBranch(overrides: Partial<LiveBranch> = {}): LiveBranch {
  return { name: 'feature/x', lastCommitDate: '2024-01-01T00:00:00Z', ...overrides }
}

let directCommitCounter = 0

export function makeDirectCommit(overrides: Partial<DirectCommit> = {}): DirectCommit {
  directCommitCounter += 1
  return {
    oid: `direct-oid-${directCommitCounter}`,
    messageHeadline: `direct commit ${directCommitCounter}`,
    authoredDate: '2023-01-01T00:00:00Z',
    author: AUTHOR,
    url: `https://github.com/o/r/commit/direct-oid-${directCommitCounter}`,
    additions: 3,
    deletions: 1,
    ...overrides,
  }
}

export function makeRelease(overrides: Partial<ReleaseInfo> = {}): ReleaseInfo {
  return {
    name: 'v1.0.0',
    tag: 'v1.0.0',
    date: '2023-01-01T00:00:00Z',
    url: 'https://github.com/o/r/releases/tag/v1.0.0',
    targetOid: null,
    ...overrides,
  }
}

export function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    meta: {
      owner: 'octo-org',
      name: 'octo-repo',
      description: 'A test repository',
      url: 'https://github.com/octo-org/octo-repo',
      stars: 42,
      forks: 4,
      createdAt: '2020-01-01T00:00:00Z',
      pushedAt: '2024-01-01T00:00:00Z',
      defaultBranch: 'main',
      license: 'MIT License',
      ...overrides.meta,
    },
    languages: overrides.languages ?? [
      { name: 'TypeScript', color: '#3178c6', bytes: 800 },
      { name: 'CSS', color: '#663399', bytes: 200 },
    ],
    releases: overrides.releases ?? [
      makeRelease({ tag: 'v1.0.0', date: '2021-01-01T00:00:00Z' }),
      makeRelease({ tag: 'v2.0.0', date: '2022-06-01T00:00:00Z' }),
      makeRelease({ tag: 'v3.0.0', date: '2023-06-01T00:00:00Z' }),
    ],
    mergedPullRequests: overrides.mergedPullRequests ?? [
      makeMergedPr({ mergedAt: '2020-06-01T00:00:00Z', createdAt: '2020-05-30T00:00:00Z' }),
      makeMergedPr({ mergedAt: '2021-06-01T00:00:00Z', createdAt: '2021-05-30T00:00:00Z' }),
      makeMergedPr({ mergedAt: '2022-09-01T00:00:00Z', createdAt: '2022-08-30T00:00:00Z' }),
      makeMergedPr({ mergedAt: '2023-09-01T00:00:00Z', createdAt: '2023-08-30T00:00:00Z' }),
    ],
    openPullRequests: overrides.openPullRequests ?? [makeOpenPr()],
    closedPullRequests: overrides.closedPullRequests ?? [],
    liveBranches: overrides.liveBranches ?? [makeBranch()],
    directCommits: overrides.directCommits ?? [],
    fetchedAt: overrides.fetchedAt ?? '2024-01-15T00:00:00Z',
    source: overrides.source ?? 'github',
  }
}
