import { describe, expect, it } from 'vitest'
import { buildTree } from './buildTree'
import { makeMergedPr, makeCommit, makeOpenPr, makeBranch, makeRelease, makeSnapshot } from './testHelpers'
import type { TreeModel } from './types'

function allElements(model: TreeModel) {
  return [
    ...model.trunk.segments,
    ...model.limbs,
    ...model.twigs,
    ...model.fruits,
    ...model.leaves,
    ...model.flowers,
    ...model.buds,
    ...model.soil,
  ]
}

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbers(item, out)
  }
  return out
}

describe('buildTree determinism', () => {
  it('produces an identical model for the same snapshot and options', () => {
    const snapshot = makeSnapshot()
    const a = buildTree(snapshot)
    const b = buildTree(snapshot)
    expect(a).toEqual(b)
  })

  it('produces a different seed (and generally different layout) for a different repo', () => {
    const a = buildTree(makeSnapshot({ meta: { ...makeSnapshot().meta, owner: 'owner-a' } }))
    const b = buildTree(makeSnapshot({ meta: { ...makeSnapshot().meta, owner: 'owner-b' } }))
    expect(a.seed).not.toBe(b.seed)
  })
})

describe('buildTree correctness invariants', () => {
  it('gives every element a stable id, a finite time, and a ref back to source data', () => {
    const model = buildTree(makeSnapshot())
    const elements = allElements(model)
    expect(elements.length).toBeGreaterThan(0)

    const seenIds = new Set<string>()
    for (const element of elements) {
      expect(typeof element.id).toBe('string')
      expect(element.id.length).toBeGreaterThan(0)
      expect(seenIds.has(element.id)).toBe(false)
      seenIds.add(element.id)

      expect(Number.isFinite(element.time)).toBe(true)

      expect(element.ref).toBeDefined()
      expect(typeof element.ref.type).toBe('string')
      expect(typeof element.ref.id).toBe('string')
      expect(element.ref.id.length).toBeGreaterThan(0)
    }
  })

  it('never produces NaN or non-finite numbers anywhere in the model', () => {
    const model = buildTree(makeSnapshot())
    const numbers = collectNumbers(model)
    expect(numbers.length).toBeGreaterThan(0)
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('keeps limb emergence heights monotonic with era start time', () => {
    const model = buildTree(makeSnapshot())
    const sortedByTime = [...model.limbs].sort((a, b) => a.time - b.time)
    for (let i = 1; i < sortedByTime.length; i++) {
      const prevHeight = sortedByTime[i - 1]!.points[0]!.position.y
      const currHeight = sortedByTime[i]!.points[0]!.position.y
      expect(currHeight).toBeGreaterThanOrEqual(prevHeight - 1e-9)
    }
  })

  it('handles a snapshot with no merged PRs, releases, or activity at all', () => {
    const snapshot = makeSnapshot({
      releases: [],
      mergedPullRequests: [],
      openPullRequests: [],
      liveBranches: [],
      directCommits: [],
      languages: [],
    })
    const model = buildTree(snapshot)
    expect(model.limbs.length).toBeGreaterThanOrEqual(1)
    expect(model.twigs).toEqual([])
    expect(model.leaves).toEqual([])
    expect(model.soil).toHaveLength(1)
    for (const value of collectNumbers(model)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('buildTree caps', () => {
  it('caps twigs per limb and folds the rest into overflowPrCount + overflow leaves', () => {
    const manyPrs = Array.from({ length: 60 }, (_, i) =>
      makeMergedPr({ mergedAt: new Date(2023, 0, 1 + i).toISOString(), commits: [makeCommit()] }),
    )
    const snapshot = makeSnapshot({
      releases: [makeRelease({ tag: 'v1', date: '2022-01-01T00:00:00Z' }), makeRelease({ tag: 'v2', date: '2022-06-01T00:00:00Z' })],
      mergedPullRequests: manyPrs,
    })
    const model = buildTree(snapshot, { maxTwigsPerLimb: 10, maxOverflowLeavesPerLimb: 5 })

    const totalTwigs = model.twigs.length
    expect(totalTwigs).toBeLessThanOrEqual(10 * model.limbs.length)

    const overflowLimb = model.limbs.find((limb) => limb.overflowPrCount > 0)
    expect(overflowLimb).toBeDefined()
  })

  it('caps buds combining open PRs and live branches', () => {
    const openPullRequests = Array.from({ length: 40 }, (_, i) => makeOpenPr({ number: 1000 + i }))
    const liveBranches = Array.from({ length: 40 }, (_, i) => makeBranch({ name: `feature/${i}` }))
    const snapshot = makeSnapshot({ openPullRequests, liveBranches })
    const model = buildTree(snapshot, { maxBuds: 20 })
    expect(model.buds.length).toBeLessThanOrEqual(20)
  })

  it('excludes the default branch from live-branch buds', () => {
    const snapshot = makeSnapshot({ liveBranches: [makeBranch({ name: 'main' })] })
    const model = buildTree(snapshot)
    expect(model.buds.some((bud) => bud.ref.type === 'branch' && bud.ref.id === 'main')).toBe(false)
  })
})
