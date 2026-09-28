import { describe, expect, it } from 'vitest'
import { computeTimeBounds } from './timeBounds'
import { buildEras, hasEnoughReleasesForEras } from './eras'
import { makeMergedPr, makeRelease, makeSnapshot } from './testHelpers'

describe('hasEnoughReleasesForEras', () => {
  it('is false for 0 or 1 releases', () => {
    expect(hasEnoughReleasesForEras(makeSnapshot({ releases: [] }))).toBe(false)
    expect(hasEnoughReleasesForEras(makeSnapshot({ releases: [makeRelease()] }))).toBe(false)
  })

  it('is true for 2+ releases', () => {
    expect(
      hasEnoughReleasesForEras(makeSnapshot({ releases: [makeRelease({ tag: 'a' }), makeRelease({ tag: 'b' })] })),
    ).toBe(true)
  })
})

describe('buildEras (release-driven)', () => {
  it('splits merged PRs into eras bounded by release dates', () => {
    const snapshot = makeSnapshot({
      releases: [
        makeRelease({ tag: 'v1', date: '2021-01-01T00:00:00Z' }),
        makeRelease({ tag: 'v2', date: '2022-01-01T00:00:00Z' }),
      ],
      mergedPullRequests: [
        makeMergedPr({ mergedAt: '2020-06-01T00:00:00Z' }), // before v1 -> prehistory era
        makeMergedPr({ mergedAt: '2021-06-01T00:00:00Z' }), // between v1 and v2
        makeMergedPr({ mergedAt: '2023-01-01T00:00:00Z' }), // after v2
      ],
    })
    const bounds = computeTimeBounds(snapshot)
    const eras = buildEras(snapshot, bounds, { maxEras: 16, minPrsPerEra: 0 })

    expect(eras.length).toBeGreaterThanOrEqual(3)
    expect(eras.reduce((sum, era) => sum + era.mergedPrs.length, 0)).toBe(3)
    // Eras stay in ascending chronological order.
    for (let i = 1; i < eras.length; i++) {
      expect(eras[i]!.startTime).toBeGreaterThanOrEqual(eras[i - 1]!.startTime)
    }
  })
})

describe('buildEras (quarters fallback)', () => {
  it('falls back to calendar quarters when there are fewer than 2 releases', () => {
    const snapshot = makeSnapshot({
      releases: [],
      meta: {
        owner: 'octo-org',
        name: 'octo-repo',
        description: null,
        url: 'https://github.com/octo-org/octo-repo',
        stars: 1,
        forks: 0,
        createdAt: '2022-01-01T00:00:00Z',
        pushedAt: '2023-01-01T00:00:00Z',
        defaultBranch: 'main',
        license: null,
      },
      mergedPullRequests: [
        makeMergedPr({ mergedAt: '2022-02-01T00:00:00Z' }),
        makeMergedPr({ mergedAt: '2022-05-01T00:00:00Z' }),
        makeMergedPr({ mergedAt: '2022-08-01T00:00:00Z' }),
        makeMergedPr({ mergedAt: '2022-11-01T00:00:00Z' }),
      ],
      fetchedAt: '2023-01-01T00:00:00Z',
    })
    const bounds = computeTimeBounds(snapshot)
    const eras = buildEras(snapshot, bounds, { maxEras: 16, minPrsPerEra: 0 })

    expect(eras.length).toBeGreaterThan(1)
    expect(eras.reduce((sum, era) => sum + era.mergedPrs.length, 0)).toBe(4)
  })

  it('produces a single era for a snapshot with no time span at all', () => {
    const snapshot = makeSnapshot({
      releases: [],
      meta: {
        owner: 'o',
        name: 'r',
        description: null,
        url: 'https://x',
        stars: 0,
        forks: 0,
        createdAt: '2024-01-01T00:00:00Z',
        pushedAt: '2024-01-01T00:00:00Z',
        defaultBranch: 'main',
        license: null,
      },
      mergedPullRequests: [],
      openPullRequests: [],
      liveBranches: [],
      directCommits: [],
      fetchedAt: '2024-01-01T00:00:00Z',
    })
    const bounds = computeTimeBounds(snapshot)
    const eras = buildEras(snapshot, bounds)
    expect(eras.length).toBeGreaterThanOrEqual(1)
    for (const era of eras) {
      expect(Number.isNaN(era.startTime)).toBe(false)
      expect(Number.isNaN(era.endTime)).toBe(false)
    }
  })
})

describe('buildEras (merge + cap)', () => {
  it('merges eras with fewer than minPrsPerEra merged PRs', () => {
    const releases = Array.from({ length: 6 }, (_, i) =>
      makeRelease({ tag: `v${i}`, date: new Date(2020 + i, 0, 1).toISOString() }),
    )
    const mergedPullRequests = [
      // Only the era starting at v2 (index 2) gets real activity; the rest are tiny.
      makeMergedPr({ mergedAt: new Date(2022, 3, 1).toISOString() }),
      makeMergedPr({ mergedAt: new Date(2022, 4, 1).toISOString() }),
      makeMergedPr({ mergedAt: new Date(2022, 5, 1).toISOString() }),
      makeMergedPr({ mergedAt: new Date(2022, 6, 1).toISOString() }),
      makeMergedPr({ mergedAt: new Date(2022, 7, 1).toISOString() }),
    ]
    const snapshot = makeSnapshot({ releases, mergedPullRequests })
    const bounds = computeTimeBounds(snapshot)
    const eras = buildEras(snapshot, bounds, { maxEras: 16, minPrsPerEra: 3 })

    // 5 total merged PRs can never fill two eras with >= 3 each, so
    // everything collapses into a single era.
    expect(eras.length).toBe(1)
    expect(eras.reduce((sum, era) => sum + era.mergedPrs.length, 0)).toBe(5)
  })

  it('caps the number of eras to maxEras', () => {
    const releases = Array.from({ length: 40 }, (_, i) =>
      makeRelease({ tag: `v${i}`, date: new Date(2000 + i, 0, 1).toISOString() }),
    )
    const mergedPullRequests = Array.from({ length: 200 }, (_, i) =>
      makeMergedPr({ mergedAt: new Date(2000 + (i % 40), 6, 1).toISOString() }),
    )
    const snapshot = makeSnapshot({ releases, mergedPullRequests })
    const bounds = computeTimeBounds(snapshot)
    const eras = buildEras(snapshot, bounds, { maxEras: 12, minPrsPerEra: 3 })

    expect(eras.length).toBeLessThanOrEqual(12)
    expect(eras.reduce((sum, era) => sum + era.mergedPrs.length, 0)).toBe(200)
  })
})
