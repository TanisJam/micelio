import { describe, expect, it } from 'vitest'
import { getMushroomGeometry } from './mushroomGeometry'

describe('getMushroomGeometry', () => {
  it('returns a geometry with matching position/color vertex counts', () => {
    const geometry = getMushroomGeometry()
    const position = geometry.getAttribute('position')
    const color = geometry.getAttribute('color')
    expect(color.count).toBe(position.count)
    expect(position.count).toBeGreaterThan(0)
  })

  it('never produces NaN/non-finite vertex data', () => {
    const geometry = getMushroomGeometry()
    for (const name of ['position', 'color']) {
      const attr = geometry.getAttribute(name)
      for (let i = 0; i < attr.array.length; i++) expect(Number.isFinite(attr.array[i])).toBe(true)
    }
  })

  it('caches and reuses the same geometry instance', () => {
    expect(getMushroomGeometry()).toBe(getMushroomGeometry())
  })
})
