import { describe, expect, it } from 'vitest'
import type { HyphaDraft } from './topology'
import { assignAngularSlots, assignSlotsWithinGroup, authorKeyOf, buildAuthorSectors, resolveSectorKey } from './sectors'

function stubDraft(overrides: Partial<HyphaDraft>): HyphaDraft {
  return {
    id: 'hypha-x',
    kind: 'merged',
    ref: { type: 'pull_request', id: '1' },
    parentHyphaId: 'hypha-main',
    rawSplitTime: 0,
    splitTime: 0,
    endTime: 100,
    status: 'fused',
    title: 'x',
    url: 'https://x',
    author: { login: null, avatarUrl: null },
    commitCount: 1,
    commits: [],
    ...overrides,
  }
}

describe('buildAuthorSectors', () => {
  it('gives every top contributor a sector proportional to their merged-PR count', () => {
    const hyphae: HyphaDraft[] = [
      ...Array.from({ length: 5 }, (_, i) => stubDraft({ id: `a${i}`, author: { login: 'alice', avatarUrl: null }, splitTime: i * 1000, kind: 'merged' })),
      ...Array.from({ length: 2 }, (_, i) => stubDraft({ id: `b${i}`, author: { login: 'bob', avatarUrl: null }, splitTime: 500 + i * 1000, kind: 'merged' })),
    ]
    const sectors = buildAuthorSectors(hyphae)
    expect(sectors.has('alice')).toBe(true)
    expect(sectors.has('bob')).toBe(true)
    expect(sectors.get('alice')!.angleWidth).toBeGreaterThan(sectors.get('bob')!.angleWidth)
  })

  it('sector widths always sum to exactly 2*pi', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: 30 }, (_, i) =>
      stubDraft({ id: `pr${i}`, author: { login: `author${i % 8}`, avatarUrl: null }, splitTime: i * 1000, kind: i % 3 === 0 ? 'closed' : 'merged' }),
    )
    const sectors = buildAuthorSectors(hyphae)
    const total = [...sectors.values()].reduce((sum, s) => sum + s.angleWidth, 0)
    expect(total).toBeCloseTo(Math.PI * 2, 6)
  })

  it('groups long-tail (non-top, or zero-merged) authors into a shared community sector', () => {
    const hyphae: HyphaDraft[] = [
      ...Array.from({ length: 10 }, (_, i) => stubDraft({ id: `a${i}`, author: { login: 'alice', avatarUrl: null }, splitTime: i * 1000, kind: 'merged' })),
      stubDraft({ id: 'c1', author: { login: 'casual', avatarUrl: null }, splitTime: 500, kind: 'closed' }), // 0 merged PRs
    ]
    const sectors = buildAuthorSectors(hyphae)
    expect(sectors.has('casual')).toBe(false)
    expect(sectors.has('community')).toBe(true)
  })

  it('is deterministic and covers every hypha with a resolvable sector', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: 20 }, (_, i) =>
      stubDraft({ id: `pr${i}`, author: { login: i % 4 === 0 ? null : `author${i % 5}`, avatarUrl: null }, splitTime: i * 1000, kind: 'merged' }),
    )
    const a = buildAuthorSectors(hyphae)
    const b = buildAuthorSectors(hyphae)
    expect([...a.entries()]).toEqual([...b.entries()])
    for (const draft of hyphae) {
      const key = resolveSectorKey(draft.author.login, a)
      expect(a.has(key)).toBe(true)
    }
  })

  it('falls back to one full-circle community sector for an empty hypha list', () => {
    const sectors = buildAuthorSectors([])
    expect(sectors.size).toBe(1)
    expect(sectors.get('community')!.angleWidth).toBeCloseTo(Math.PI * 2, 6)
  })
})

describe('assignAngularSlots', () => {
  it('assigns every hypha an angle strictly within its own sector', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: 25 }, (_, i) =>
      stubDraft({ id: `pr${i}`, author: { login: `author${i % 6}`, avatarUrl: null }, splitTime: i * 1000, endTime: i * 1000 + 500, kind: 'merged' }),
    )
    const sectors = buildAuthorSectors(hyphae)
    const slots = assignAngularSlots(hyphae, sectors, 'o/r')
    for (const draft of hyphae) {
      const slot = slots.get(draft.id)!
      const twoPi = Math.PI * 2
      const relative = (((slot.angle - slot.sector.angleStart) % twoPi) + twoPi) % twoPi
      expect(relative).toBeGreaterThanOrEqual(-1e-9)
      expect(relative).toBeLessThanOrEqual(slot.sector.angleWidth + 1e-9)
    }
  })

  it('is deterministic for the same seed', () => {
    const hyphae: HyphaDraft[] = Array.from({ length: 10 }, (_, i) => stubDraft({ id: `pr${i}`, author: { login: 'alice', avatarUrl: null }, splitTime: i * 1000 }))
    const sectors = buildAuthorSectors(hyphae)
    const a = assignAngularSlots(hyphae, sectors, 'o/r')
    const b = assignAngularSlots(hyphae, sectors, 'o/r')
    expect([...a.entries()]).toEqual([...b.entries()])
  })
})

describe('assignSlotsWithinGroup', () => {
  it('assigns non-overlapping lanes to overlapping-time items', () => {
    const items = [
      { id: 'a', splitTime: 0, endTime: 10 },
      { id: 'b', splitTime: 2, endTime: 8 }, // overlaps a
      { id: 'c', splitTime: 20, endTime: 30 }, // no overlap with a
    ]
    const slots = assignSlotsWithinGroup(items)
    expect(slots.get('a')!.slot).not.toBe(slots.get('b')!.slot)
    expect(slots.get('a')!.slot).toBe(slots.get('c')!.slot) // c can reuse a's lane, a already ended
    expect(slots.get('a')!.slotCount).toBe(slots.get('b')!.slotCount)
  })
})

describe('authorKeyOf / resolveSectorKey', () => {
  it('maps a null login to the community key', () => {
    expect(authorKeyOf(null)).toBe('community')
    expect(authorKeyOf('alice')).toBe('alice')
  })

  it('resolves an unlisted author to community', () => {
    const sectors = buildAuthorSectors([stubDraft({ author: { login: 'alice', avatarUrl: null } })])
    expect(resolveSectorKey('someone-else', sectors)).toBe('community')
  })
})
