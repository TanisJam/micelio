import { describe, expect, it } from 'vitest'
import { buildNetwork } from './buildNetwork'
import { getNetworkElementFocusPosition } from './focus'
import { makeSnapshot } from '../tree/testHelpers'

describe('getNetworkElementFocusPosition', () => {
  const model = buildNetwork(makeSnapshot())

  it('focuses the spore at its own position', () => {
    expect(getNetworkElementFocusPosition(model, 'spore')).toEqual(model.spore.position)
  })

  it('returns null for an unknown id', () => {
    expect(getNetworkElementFocusPosition(model, 'nope')).toBeNull()
  })

  it('focuses a hypha at the midpoint of its polyline', () => {
    const hypha = model.hyphae[1]!
    const focus = getNetworkElementFocusPosition(model, hypha.id)
    expect(focus).toEqual(hypha.points[Math.floor(hypha.points.length / 2)]!.position)
  })

  it('focuses a node/mushroom/tip at its own position', () => {
    const node = model.nodes[0]!
    expect(getNetworkElementFocusPosition(model, node.id)).toEqual(node.position)

    const mushroom = model.mushrooms[0]!
    expect(getNetworkElementFocusPosition(model, mushroom.id)).toEqual(mushroom.position)
  })
})
