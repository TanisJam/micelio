import { describe, expect, it } from 'vitest'
import { buildNetwork } from './buildNetwork'
import { findNetworkElement } from './lookup'
import { makeSnapshot } from '../tree/testHelpers'

describe('findNetworkElement', () => {
  const model = buildNetwork(makeSnapshot())

  it('returns null for the synthetic spore id', () => {
    expect(findNetworkElement(model, 'spore')).toBeNull()
  })

  it('returns null for an unknown id', () => {
    expect(findNetworkElement(model, 'does-not-exist')).toBeNull()
  })

  it('finds a hypha by id', () => {
    const hypha = model.hyphae[1]!
    expect(findNetworkElement(model, hypha.id)).toBe(hypha)
  })

  it('finds a node by id', () => {
    const node = model.nodes[0]!
    expect(findNetworkElement(model, node.id)).toBe(node)
  })

  it('finds a mushroom by id', () => {
    const mushroom = model.mushrooms[0]!
    expect(findNetworkElement(model, mushroom.id)).toBe(mushroom)
  })

  it('finds a tip by id, when one exists', () => {
    if (model.tips.length === 0) return
    const tip = model.tips[0]!
    expect(findNetworkElement(model, tip.id)).toBe(tip)
  })
})
