import { describe, expect, it } from 'vitest'
import { buildTree } from './buildTree'
import { getElementFocusPosition } from './focus'
import { makeSnapshot } from './testHelpers'

function expectFiniteVec3(value: { x: number; y: number; z: number } | null) {
  expect(value).not.toBeNull()
  expect(Number.isFinite(value!.x)).toBe(true)
  expect(Number.isFinite(value!.y)).toBe(true)
  expect(Number.isFinite(value!.z)).toBe(true)
}

describe('getElementFocusPosition', () => {
  const model = buildTree(makeSnapshot())

  it('focuses the trunk midpoint for the synthetic trunk id', () => {
    const position = getElementFocusPosition(model, 'trunk')
    expectFiniteVec3(position)
    expect(position!.y).toBeCloseTo(model.trunk.height * 0.5)
  })

  it('returns null for an unknown id', () => {
    expect(getElementFocusPosition(model, 'not-a-real-id')).toBeNull()
  })

  it('focuses the midpoint of a limb polyline', () => {
    const limb = model.limbs[0]!
    const position = getElementFocusPosition(model, limb.id)
    expectFiniteVec3(position)
    expect(position).toEqual(limb.points[Math.floor(limb.points.length / 2)]!.position)
  })

  it('focuses the tip of a twig', () => {
    const twig = model.twigs[0]!
    const position = getElementFocusPosition(model, twig.id)
    expect(position).toEqual(twig.points[twig.points.length - 1]!.position)
  })

  it('focuses a leaf, fruit, flower and bud at their own position', () => {
    expect(getElementFocusPosition(model, model.leaves[0]!.id)).toEqual(model.leaves[0]!.position)
    expect(getElementFocusPosition(model, model.fruits[0]!.id)).toEqual(model.fruits[0]!.position)
    expect(getElementFocusPosition(model, model.flowers[0]!.id)).toEqual(model.flowers[0]!.position)
    if (model.buds[0]) {
      expect(getElementFocusPosition(model, model.buds[0].id)).toEqual(model.buds[0].position)
    }
  })
})
