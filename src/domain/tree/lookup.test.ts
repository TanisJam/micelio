import { describe, expect, it } from 'vitest'
import { buildTree } from './buildTree'
import { findTreeElement } from './lookup'
import { makeSnapshot } from './testHelpers'

describe('findTreeElement', () => {
  const model = buildTree(makeSnapshot())

  it('returns null for the synthetic trunk id', () => {
    expect(findTreeElement(model, 'trunk')).toBeNull()
  })

  it('returns null for an unknown id', () => {
    expect(findTreeElement(model, 'not-a-real-id')).toBeNull()
  })

  it('finds a limb by id', () => {
    const target = model.limbs[0]!
    expect(findTreeElement(model, target.id)).toBe(target)
  })

  it('finds a twig by id', () => {
    const target = model.twigs[0]!
    expect(findTreeElement(model, target.id)).toBe(target)
  })

  it('finds a fruit by id', () => {
    const target = model.fruits[0]!
    expect(findTreeElement(model, target.id)).toBe(target)
  })

  it('finds a leaf by id', () => {
    const target = model.leaves[0]!
    expect(findTreeElement(model, target.id)).toBe(target)
  })

  it('finds a flower by id', () => {
    const target = model.flowers[0]!
    expect(findTreeElement(model, target.id)).toBe(target)
  })
})
