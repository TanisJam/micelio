import { describe, expect, it } from 'vitest'
import { makeDirectCommit } from '../shared/testHelpers'
import { DIRECT_BURST_MAX_COMMITS, DIRECT_BURST_MAX_TARGET, groupDirectCommitBursts } from './directBursts'

const ONE_MINUTE_MS = 60 * 1000
const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000

/** A run of `count` commits by `login`, one minute apart, starting at `base`. */
function soloStreak(base: number, count: number, login: string): ReturnType<typeof makeDirectCommit>[] {
  return Array.from({ length: count }, (_, i) =>
    makeDirectCommit({
      oid: `${login}-${i}`,
      authoredDate: new Date(base + i * ONE_MINUTE_MS).toISOString(),
      author: { login, avatarUrl: null },
    }),
  )
}

describe('groupDirectCommitBursts (adaptive scaling)', () => {
  it('scales a small solo repo (production feedback: TanisJam/lime, 127 direct commits) into a lush, not sparse, hypha count', () => {
    const commits = soloStreak(Date.parse('2024-01-01T00:00:00Z'), 127, 'alice')

    const bursts = groupDirectCommitBursts(commits)

    // Every commit is accounted for exactly once, still same-author and
    // time-contiguous within each burst.
    expect(bursts.reduce((sum, b) => sum + b.commits.length, 0)).toBe(127)
    for (const burst of bursts) {
      expect(burst.commits.every((c) => c.author.login === 'alice')).toBe(true)
      expect(burst.firstTime).toBeLessThanOrEqual(burst.lastTime)
    }
    // Before this fix, a fixed 40-commits-per-burst chunk size produced
    // only ceil(127 / 40) = 4 hyphae here -- "only ~10 filaments" once
    // combined with the repo's one real PR/branches, read as sparse. The
    // target is roughly commits/3..commits/4 (≈ 32-42); assert a lush
    // range comfortably inside that, never collapsing back to single digits.
    expect(bursts.length).toBeGreaterThanOrEqual(25)
    expect(bursts.length).toBeLessThanOrEqual(45)
  })

  it('scales burst count up as one unbroken solo streak grows, always accounting for every commit exactly once', () => {
    let previousCount = 0
    for (const count of [5, 20, 127, 600, 5000]) {
      const commits = soloStreak(Date.parse('2024-01-01T00:00:00Z'), count, 'alice')
      const bursts = groupDirectCommitBursts(commits)
      expect(bursts.reduce((sum, b) => sum + b.commits.length, 0)).toBe(count)
      expect(bursts.length).toBeGreaterThanOrEqual(previousCount)
      // Every chunk stays within the meaningful-burst floor/ceiling.
      for (const burst of bursts) {
        expect(burst.commits.length).toBeLessThanOrEqual(DIRECT_BURST_MAX_COMMITS)
      }
      previousCount = bursts.length
    }
  })

  it('caps a very large solo streak at DIRECT_BURST_MAX_TARGET bursts instead of fragmenting into hundreds more', () => {
    const commits = soloStreak(Date.parse('2024-01-01T00:00:00Z'), 5000, 'alice')
    const bursts = groupDirectCommitBursts(commits)
    expect(bursts.length).toBeLessThanOrEqual(DIRECT_BURST_MAX_TARGET)
    // Still every commit accounted for.
    expect(bursts.reduce((sum, b) => sum + b.commits.length, 0)).toBe(5000)
  })

  it('never chunks a burst more coarsely than the fixed DIRECT_BURST_MAX_COMMITS ceiling', () => {
    const commits = soloStreak(Date.parse('2024-01-01T00:00:00Z'), 5000, 'alice')
    const bursts = groupDirectCommitBursts(commits)
    for (const burst of bursts) expect(burst.commits.length).toBeLessThanOrEqual(DIRECT_BURST_MAX_COMMITS)
  })

  it('leaves a big, busy multi-author repo unaffected beyond the caps: real author/gap diversity already splits bursts short of any chunk-size cap', () => {
    // 60 short (5-commit) same-author streaks by different authors, each
    // separated by a real 7h gap (over the 6h same-burst window) -- the
    // kind of pattern a large multi-contributor repo's direct-push history
    // actually looks like. No individual streak is anywhere near either the
    // old fixed 40-commits-per-burst cap or the new adaptive one, so the
    // resulting burst count must be determined ENTIRELY by author/gap
    // grouping, identical to what the un-adaptive (fixed-40) grouping would
    // have produced.
    let cursor = Date.parse('2024-01-01T00:00:00Z')
    const commits: ReturnType<typeof makeDirectCommit>[] = []
    for (let author = 0; author < 60; author++) {
      commits.push(...soloStreak(cursor, 5, `author-${author}`))
      cursor += SEVEN_HOURS_MS
    }

    const bursts = groupDirectCommitBursts(commits)

    expect(bursts).toHaveLength(60)
    for (const burst of bursts) expect(burst.commits).toHaveLength(5)
    expect(bursts.reduce((sum, b) => sum + b.commits.length, 0)).toBe(300)
  })

  it('still splits a burst on a real time gap (same-author, not merely a count-based chunk boundary)', () => {
    const base = Date.parse('2024-01-01T00:00:00Z')
    const commits = [
      ...soloStreak(base, 3, 'alice'),
      ...soloStreak(base + SEVEN_HOURS_MS, 3, 'alice'),
    ]
    const bursts = groupDirectCommitBursts(commits)
    expect(bursts).toHaveLength(2)
    expect(bursts[0]!.commits).toHaveLength(3)
    expect(bursts[1]!.commits).toHaveLength(3)
  })

  it('still splits a burst on an author change with no time gap', () => {
    const base = Date.parse('2024-01-01T00:00:00Z')
    const commits = [
      makeDirectCommit({ oid: 'a', authoredDate: new Date(base).toISOString(), author: { login: 'alice', avatarUrl: null } }),
      makeDirectCommit({ oid: 'b', authoredDate: new Date(base + 1000).toISOString(), author: { login: 'bob', avatarUrl: null } }),
    ]
    const bursts = groupDirectCommitBursts(commits)
    expect(bursts).toHaveLength(2)
  })

  it('gives an anonymous (null login) commit its own singleton burst rather than merging with a neighbor', () => {
    const base = Date.parse('2024-01-01T00:00:00Z')
    const commits = [
      makeDirectCommit({ oid: 'a', authoredDate: new Date(base).toISOString(), author: { login: null, avatarUrl: null } }),
      makeDirectCommit({ oid: 'b', authoredDate: new Date(base + 1000).toISOString(), author: { login: null, avatarUrl: null } }),
    ]
    const bursts = groupDirectCommitBursts(commits)
    expect(bursts).toHaveLength(2)
    expect(bursts.every((b) => b.commits.length === 1)).toBe(true)
  })

  it('returns an empty list for no commits', () => {
    expect(groupDirectCommitBursts([])).toEqual([])
  })
})
