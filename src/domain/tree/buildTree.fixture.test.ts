import { describe, expect, it } from 'vitest'
import type { RepoSnapshot } from '../repo'
import { buildTree } from './buildTree'
import { computeTimeBounds } from './timeBounds'
import valtioFixture from '../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }

const snapshot = valtioFixture as RepoSnapshot

describe('buildTree (fixture smoke test: pmndrs/valtio)', () => {
  it('produces sane time bounds', () => {
    const bounds = computeTimeBounds(snapshot)
    expect(bounds.firstEventTime).toBeLessThan(bounds.lastEventTime)
    expect(bounds.firstEventTime).toBeGreaterThan(Date.parse('2015-01-01T00:00:00Z'))
    expect(bounds.lastEventTime).toBeLessThan(Date.now() + 24 * 60 * 60 * 1000)
  })

  it('builds a full model without NaNs and within the documented caps', () => {
    const model = buildTree(snapshot)

    expect(model.trunk.height).toBeGreaterThan(0)
    expect(model.trunk.segments.length).toBeGreaterThan(0)
    expect(model.limbs.length).toBeGreaterThan(0)
    expect(model.limbs.length).toBeLessThanOrEqual(16)
    expect(model.twigs.length).toBeGreaterThan(0)
    expect(model.fruits.length).toBe(model.twigs.length)
    expect(model.leaves.length).toBeGreaterThan(0)
    expect(model.flowers.length).toBe(snapshot.releases.length)
    expect(model.soil.length).toBe(snapshot.languages.length)

    for (const limb of model.limbs) {
      expect(limb.activity).toBeGreaterThanOrEqual(0)
    }

    const soilTotal = model.soil.reduce((sum, stratum) => sum + stratum.share, 0)
    expect(soilTotal).toBeCloseTo(1, 5)
  })

  it('is deterministic on the real fixture too', () => {
    const a = buildTree(snapshot)
    const b = buildTree(snapshot)
    expect(a).toEqual(b)
  })
})
