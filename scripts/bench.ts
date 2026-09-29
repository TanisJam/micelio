#!/usr/bin/env tsx
/**
 * Optional wall-clock timing for `buildNetwork` at the real server caps
 * (B3/T8) -- informational only, never asserted/gated in CI (the
 * deterministic operation-count proxy in `buildNetwork.test.ts` is what
 * actually gates the suite, since wall-clock timing is flaky under CI/
 * parallel-worker load). Run with: `pnpm bench`.
 */
import { buildNetwork } from '../src/domain/network/buildNetwork.ts'
import type { CommitAuthor, MergedPullRequest, RepoSnapshot } from '../src/domain/repo.ts'

const AUTHOR: CommitAuthor = { login: 'author', avatarUrl: null }
const DAY = 86_400_000
const base = Date.parse('2015-01-01T00:00:00Z')

function buildSnapshotAtRealCaps(): RepoSnapshot {
  const mergedPullRequests: MergedPullRequest[] = Array.from({ length: 1000 }, (_, i) => {
    const splitAt = base + i * DAY * 3
    const mergedAt = splitAt + DAY * 2
    return {
      number: i + 1,
      title: `PR ${i + 1}`,
      author: AUTHOR,
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
        author: AUTHOR,
        url: 'https://x',
      })),
    }
  })

  const closedPullRequests = Array.from({ length: 200 }, (_, i) => ({
    number: 100_000 + i,
    title: `Closed PR ${i}`,
    author: AUTHOR,
    createdAt: new Date(base + i * DAY * 5).toISOString(),
    closedAt: new Date(base + i * DAY * 5 + DAY).toISOString(),
    url: `https://x/pull/${100_000 + i}`,
    baseRefName: 'main',
    headRefName: `closed-${i}`,
    firstCommitTime: new Date(base + i * DAY * 5).toISOString(),
    commitCount: 8,
    commits: Array.from({ length: 8 }, (_, k) => ({
      oid: `closed-oid-${i}-${k}`,
      messageHeadline: `closed commit ${k}`,
      authoredDate: new Date(base + i * DAY * 5 + k * 1000).toISOString(),
      author: AUTHOR,
      url: 'https://x',
    })),
  }))

  const openPullRequests = Array.from({ length: 50 }, (_, i) => ({
    number: 200_000 + i,
    title: `Open PR ${i}`,
    author: AUTHOR,
    createdAt: new Date(base + DAY * 3000 + i * DAY).toISOString(),
    url: `https://x/pull/${200_000 + i}`,
    baseRefName: 'main',
    headRefName: `open-${i}`,
    firstCommitTime: new Date(base + DAY * 3000 + i * DAY).toISOString(),
    commitCount: 1,
    commits: [
      {
        oid: `open-oid-${i}`,
        messageHeadline: 'wip',
        authoredDate: new Date(base + DAY * 3000 + i * DAY).toISOString(),
        author: AUTHOR,
        url: 'https://x',
      },
    ],
  }))

  const liveBranches = Array.from({ length: 100 }, (_, i) => ({
    name: `branch-${i}`,
    lastCommitDate: new Date(base + DAY * (1000 + i * 10)).toISOString(),
  }))

  const releases = Array.from({ length: 100 }, (_, i) => ({
    name: `v${i}.0.0`,
    tag: `v${i}.0.0`,
    date: new Date(base + i * DAY * 30).toISOString(),
    url: 'https://x',
    targetOid: null,
  }))

  return {
    meta: {
      owner: 'bench-org',
      name: 'bench-repo',
      description: 'Synthetic benchmark repository',
      url: 'https://x',
      stars: 0,
      forks: 0,
      createdAt: new Date(base).toISOString(),
      pushedAt: new Date().toISOString(),
      defaultBranch: 'main',
      license: null,
    },
    languages: [],
    releases,
    mergedPullRequests,
    openPullRequests,
    closedPullRequests,
    liveBranches,
    directCommits: [],
    fetchedAt: new Date().toISOString(),
    source: 'github',
  }
}

function main(): void {
  const snapshot = buildSnapshotAtRealCaps()
  const runs = 5
  const timings: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    buildNetwork(snapshot)
    timings.push(performance.now() - start)
  }
  console.log(`buildNetwork at the real server caps (1000 merged PRs x 20 commits, 200 closed, 50 open, 100 branches, 100 releases):`)
  for (const [i, ms] of timings.entries()) console.log(`  run ${i + 1}: ${ms.toFixed(1)}ms`)
  console.log(`  median: ${timings.slice().sort((a, b) => a - b)[Math.floor(runs / 2)]!.toFixed(1)}ms`)
}

main()
