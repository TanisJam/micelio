import { describe, expect, it } from 'vitest'
import { buildPickGrid, queryNearest, type PickTarget } from './pickingGrid'

/** A target that's always visible, for tests not exercising the growth-time filter. */
function target(partial: Omit<PickTarget, 'visibleAt'> & { visibleAt?: number }): PickTarget {
  return { visibleAt: 0, ...partial }
}

describe('pickingGrid', () => {
  it('finds the nearest segment within tolerance', () => {
    const targets: PickTarget[] = [
      target({ id: 'a', x1: 0, z1: 0, x2: 1, z2: 0 }),
      target({ id: 'b', x1: 5, z1: 5, x2: 6, z2: 5 }),
    ]
    const grid = buildPickGrid(targets, 1)
    const result = queryNearest(grid, 0.5, 0.1, 0.5)
    expect(result?.id).toBe('a')
  })

  it('returns null when nothing is within tolerance', () => {
    const targets: PickTarget[] = [target({ id: 'a', x1: 0, z1: 0, x2: 1, z2: 0 })]
    const grid = buildPickGrid(targets, 1)
    expect(queryNearest(grid, 10, 10, 0.5)).toBeNull()
  })

  it('picks the closer of two overlapping-cell candidates', () => {
    const targets: PickTarget[] = [
      target({ id: 'near', x1: 0, z1: 0, x2: 0, z2: 0 }),
      target({ id: 'far', x1: 0.4, z1: 0, x2: 0.4, z2: 0 }),
    ]
    const grid = buildPickGrid(targets, 0.5)
    const result = queryNearest(grid, 0.05, 0, 1)
    expect(result?.id).toBe('near')
  })

  it('handles a point target (x1===x2, z1===z2)', () => {
    const targets: PickTarget[] = [target({ id: 'point', x1: 2, z1: 2, x2: 2, z2: 2 })]
    const grid = buildPickGrid(targets, 1)
    const result = queryNearest(grid, 2.05, 1.98, 0.5)
    expect(result?.id).toBe('point')
    expect(result?.distance).toBeGreaterThanOrEqual(0)
  })

  it('finds a target whose nearest point lies in an adjacent cell to the query', () => {
    // A long segment spanning several cells; query near one end, far from
    // that end's own cell center, to exercise the neighboring-cell scan.
    const targets: PickTarget[] = [target({ id: 'long', x1: -10, z1: 0, x2: 10, z2: 0 })]
    const grid = buildPickGrid(targets, 1)
    const result = queryNearest(grid, 9.9, 0.05, 0.5)
    expect(result?.id).toBe('long')
  })

  it('is stable/deterministic across repeated queries', () => {
    const targets: PickTarget[] = [
      target({ id: 'a', x1: 0, z1: 0, x2: 1, z2: 1 }),
      target({ id: 'b', x1: 1, z1: 0, x2: 0, z2: 1 }),
    ]
    const grid = buildPickGrid(targets, 0.5)
    const first = queryNearest(grid, 0.5, 0.5, 0.5)
    const second = queryNearest(grid, 0.5, 0.5, 0.5)
    expect(first).toEqual(second)
  })

  it('never throws for an empty target set', () => {
    const grid = buildPickGrid([], 1)
    expect(queryNearest(grid, 0, 0, 1)).toBeNull()
  })

  it('handles a degenerate (non-positive) cell size by falling back to a safe default', () => {
    const targets: PickTarget[] = [target({ id: 'a', x1: 0, z1: 0, x2: 1, z2: 0 })]
    const grid = buildPickGrid(targets, 0)
    expect(() => queryNearest(grid, 0.5, 0, 0.5)).not.toThrow()
  })

  describe('growth-time filtering (A2/T8)', () => {
    it('excludes a target whose visibleAt is still in the future', () => {
      const targets: PickTarget[] = [target({ id: 'not-yet-grown', x1: 0, z1: 0, x2: 1, z2: 0, visibleAt: 1000 })]
      const grid = buildPickGrid(targets, 1)
      expect(queryNearest(grid, 0.5, 0, 0.5, 500)).toBeNull()
    })

    it('includes a target once currentTime reaches its visibleAt', () => {
      const targets: PickTarget[] = [target({ id: 'grown', x1: 0, z1: 0, x2: 1, z2: 0, visibleAt: 1000 })]
      const grid = buildPickGrid(targets, 1)
      expect(queryNearest(grid, 0.5, 0, 0.5, 1000)?.id).toBe('grown')
      expect(queryNearest(grid, 0.5, 0, 0.5, 1500)?.id).toBe('grown')
    })

    it('falls through to the next-nearest target that IS already visible', () => {
      const targets: PickTarget[] = [
        target({ id: 'closer-but-hidden', x1: 0, z1: 0, x2: 0, z2: 0, visibleAt: 1000 }),
        target({ id: 'farther-but-visible', x1: 0.2, z1: 0, x2: 0.2, z2: 0, visibleAt: 0 }),
      ]
      const grid = buildPickGrid(targets, 1)
      // Without time filtering, 'closer-but-hidden' would win (it's nearer).
      expect(queryNearest(grid, 0, 0, 1)?.id).toBe('closer-but-hidden')
      // With growth time honored, only the visible one can be picked.
      expect(queryNearest(grid, 0, 0, 1, 500)?.id).toBe('farther-but-visible')
    })

    it('defaults to no time filtering when currentTime is omitted', () => {
      const targets: PickTarget[] = [target({ id: 'far-future', x1: 0, z1: 0, x2: 1, z2: 0, visibleAt: Number.MAX_SAFE_INTEGER })]
      const grid = buildPickGrid(targets, 1)
      expect(queryNearest(grid, 0.5, 0, 0.5)?.id).toBe('far-future')
    })
  })
})
