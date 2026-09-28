import { describe, expect, it } from 'vitest'
import type { SoilStratum } from '../../../domain/tree'
import { buildIslandGeometry } from './island'

function makeSoil(shares: [string, number, string | null][]): SoilStratum[] {
  let offset = 0
  return shares.map(([name, share, color]) => {
    const stratum: SoilStratum = {
      id: `soil-${name}`,
      kind: 'soilStratum',
      time: 0,
      ref: { type: 'language', id: name },
      share,
      offset,
      color,
    }
    offset += share
    return stratum
  })
}

describe('buildIslandGeometry', () => {
  it('builds a single merged geometry with matching position/color vertex counts', () => {
    const soil = makeSoil([
      ['TypeScript', 0.7, '#3178c6'],
      ['CSS', 0.3, '#663399'],
    ])
    const geometry = buildIslandGeometry(soil, 'octo/repo')
    const position = geometry.getAttribute('position')
    const color = geometry.getAttribute('color')
    expect(position.count).toBeGreaterThan(0)
    expect(color.count).toBe(position.count)
  })

  it('never produces NaN or infinite vertex positions', () => {
    const soil = makeSoil([['Unknown', 1, null]])
    const geometry = buildIslandGeometry(soil, 'octo/repo')
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true)
      expect(Number.isFinite(position.getY(i))).toBe(true)
      expect(Number.isFinite(position.getZ(i))).toBe(true)
    }
  })

  it('is deterministic for the same seed', () => {
    const soil = makeSoil([
      ['TypeScript', 0.5, '#3178c6'],
      ['Go', 0.5, '#00add8'],
    ])
    const a = buildIslandGeometry(soil, 'octo/repo')
    const b = buildIslandGeometry(soil, 'octo/repo')
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array))
  })

  it('handles many small strata without throwing', () => {
    const languages = Array.from({ length: 12 }, (_, i) => [`lang-${i}`, 1 / 12, '#abcdef'] as [string, number, string])
    expect(() => buildIslandGeometry(makeSoil(languages), 'octo/repo')).not.toThrow()
  })
})
