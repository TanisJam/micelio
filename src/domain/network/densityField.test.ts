import { describe, expect, it } from 'vitest'
import { makeMergedPr, makeSnapshot } from '../shared/testHelpers'
import { buildNetwork } from './buildNetwork'
import { buildDensityField, DENSITY_FIELD_RESOLUTION } from './densityField'

describe('buildDensityField', () => {
  it('is deterministic: the same model always produces an identical field', () => {
    const model = buildNetwork(makeSnapshot())
    const a = buildDensityField(model)
    const b = buildDensityField(model)
    expect(a).toEqual(b)
  })

  it('defaults to DENSITY_FIELD_RESOLUTION and honors an explicit resolution override', () => {
    const model = buildNetwork(makeSnapshot())
    const field = buildDensityField(model)
    expect(field.resolution).toBe(DENSITY_FIELD_RESOLUTION)
    expect(field.raw).toHaveLength(DENSITY_FIELD_RESOLUTION * DENSITY_FIELD_RESOLUTION)
    expect(field.density).toHaveLength(DENSITY_FIELD_RESOLUTION * DENSITY_FIELD_RESOLUTION)
    expect(field.birthTime).toHaveLength(DENSITY_FIELD_RESOLUTION * DENSITY_FIELD_RESOLUTION)

    const small = buildDensityField(model, 16)
    expect(small.resolution).toBe(16)
    expect(small.raw).toHaveLength(256)
  })

  it('never produces NaN, negative, or out-of-[0,1) density anywhere', () => {
    const model = buildNetwork(makeSnapshot())
    const field = buildDensityField(model)
    for (let i = 0; i < field.density.length; i++) {
      expect(Number.isNaN(field.density[i])).toBe(false)
      expect(field.density[i]!).toBeGreaterThanOrEqual(0)
      expect(field.density[i]!).toBeLessThanOrEqual(1)
      expect(Number.isNaN(field.raw[i])).toBe(false)
      expect(field.raw[i]!).toBeGreaterThanOrEqual(0)
    }
  })

  it('is denser at the spore (the origin) than at the field\'s own far corner', () => {
    const model = buildNetwork(makeSnapshot())
    const field = buildDensityField(model)
    const center = Math.floor(field.resolution / 2)
    const centerIndex = center * field.resolution + center
    const cornerIndex = 0
    expect(field.density[centerIndex]!).toBeGreaterThan(field.density[cornerIndex]!)
  })

  it('gives a real (finite) birth time only where density is non-negligible, and Infinity in the empty far corner', () => {
    const model = buildNetwork(makeSnapshot())
    const field = buildDensityField(model)
    const center = Math.floor(field.resolution / 2)
    const centerIndex = center * field.resolution + center
    expect(Number.isFinite(field.birthTime[centerIndex])).toBe(true)
    expect(field.birthTime[0]).toBe(Number.POSITIVE_INFINITY)
    expect(field.density[0]).toBeCloseTo(0, 5)
  })

  it('accumulates more raw weight with strictly more real structure (a 2-PR snapshot vs. its own 1-PR subset)', () => {
    const pr1 = makeMergedPr({ number: 1, baseRefName: 'main', headRefName: 'a', mergedAt: '2021-01-01T00:00:00Z', createdAt: '2020-12-01T00:00:00Z' })
    const pr2 = makeMergedPr({ number: 2, baseRefName: 'main', headRefName: 'b', mergedAt: '2022-01-01T00:00:00Z', createdAt: '2021-12-01T00:00:00Z' })
    const oneSnapshot = makeSnapshot({ mergedPullRequests: [pr1], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [] })
    const twoSnapshot = makeSnapshot({ mergedPullRequests: [pr1, pr2], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [] })

    const oneField = buildDensityField(buildNetwork(oneSnapshot))
    const twoField = buildDensityField(buildNetwork(twoSnapshot))

    const sum = (field: Float32Array) => field.reduce((a, b) => a + b, 0)
    expect(sum(twoField.raw)).toBeGreaterThan(sum(oneField.raw))
  })

  it('handles a tiny repo (spore only) without NaN/Infinity density and a real spore birth time', () => {
    const model = buildNetwork(
      makeSnapshot({ mergedPullRequests: [], openPullRequests: [], closedPullRequests: [], liveBranches: [], releases: [], directCommits: [] }),
    )
    const field = buildDensityField(model)
    for (const value of field.density) expect(Number.isFinite(value)).toBe(true)
    const center = Math.floor(field.resolution / 2)
    expect(Number.isFinite(field.birthTime[center * field.resolution + center])).toBe(true)
  })
})
