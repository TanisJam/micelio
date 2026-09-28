import { describe, expect, it } from 'vitest'
import type { RepoSnapshot } from '../repo'
import { buildTree } from './buildTree'
import { computeModelBounds } from './bounds'
import { makeSnapshot } from './testHelpers'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }

describe('computeModelBounds', () => {
  const snapshot = valtioFixture as RepoSnapshot
  const model = buildTree(snapshot)
  const bounds = computeModelBounds(model)

  it('returns a finite center and a positive radius', () => {
    expect(Number.isFinite(bounds.center.x)).toBe(true)
    expect(Number.isFinite(bounds.center.y)).toBe(true)
    expect(Number.isFinite(bounds.center.z)).toBe(true)
    expect(bounds.radius).toBeGreaterThan(0)
  })

  it('encloses every trunk segment, limb point, twig point and leaf', () => {
    const points = [
      ...model.trunk.segments.flatMap((segment) => [segment.start, segment.end]),
      ...model.limbs.flatMap((limb) => limb.points.map((point) => point.position)),
      ...model.twigs.flatMap((twig) => twig.points.map((point) => point.position)),
      ...model.leaves.map((leaf) => leaf.position),
    ]

    for (const point of points) {
      const dx = point.x - bounds.center.x
      const dy = point.y - bounds.center.y
      const dz = point.z - bounds.center.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      expect(distance).toBeLessThanOrEqual(bounds.radius)
    }
  })

  it('maxHeight is at least the trunk height', () => {
    expect(bounds.maxHeight).toBeGreaterThanOrEqual(model.trunk.height * 0.9)
  })

  it('is deterministic for the same model', () => {
    expect(computeModelBounds(model)).toEqual(bounds)
  })

  it('handles a degenerate single-point model without NaN', () => {
    const empty = buildTree(
      makeSnapshot({
        mergedPullRequests: [],
        openPullRequests: [],
        liveBranches: [],
        releases: [],
        directCommits: [],
      }),
    )
    const emptyBounds = computeModelBounds(empty)
    expect(Number.isFinite(emptyBounds.radius)).toBe(true)
    expect(Number.isFinite(emptyBounds.center.y)).toBe(true)
  })
})
