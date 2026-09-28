import { describe, expect, it } from 'vitest'
import type { Fusion, Hair, Hypha, NetworkModel } from '../../../../domain/network'
import { buildFilamentsGeometry } from './filamentsGeometry'

function baseModel(): NetworkModel {
  return {
    seed: 'test/repo',
    layout: 'colony',
    bounds: { time: { firstEventTime: 0, lastEventTime: 100 }, radius: 5 },
    spore: { id: 'spore', kind: 'spore', time: 0, ref: { type: 'repo', id: 'test/repo' }, position: { x: 0, y: 0, z: 0 } },
    hyphae: [],
    nodes: [],
    tips: [],
    mushrooms: [],
    hairs: [],
    rings: [],
    fusions: [],
    overflow: { hyphaeOmitted: 0, nodesOmittedByHypha: {} },
    summary: {
      hyphaCountByKind: { main: 0, merged: 0, closed: 0, open: 0, liveBranch: 0 },
      nodeCount: 0,
      mushroomCount: 0,
      hairCount: 0,
      fusionCount: 0,
    },
  }
}

function makeHair(overrides: Partial<Hair>): Hair {
  return {
    id: 'hair-node-1',
    kind: 'hair',
    hyphaId: 'hypha-pr1',
    nodeId: 'node-1',
    time: 50,
    ref: { type: 'commit', id: 'abc' },
    position: { x: 1, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    length: 0.05,
    baseRadius: 0.005,
    ...overrides,
  }
}

describe('buildFilamentsGeometry', () => {
  it('produces one line segment (2 vertices) per hair', () => {
    const model = baseModel()
    model.hairs = [makeHair({}), makeHair({ id: 'hair-node-2', nodeId: 'node-2' })]
    const { geometry } = buildFilamentsGeometry(model, new Map([['hypha-pr1', 0]]))
    expect(geometry.getAttribute('position').count).toBe(4)
  })

  it('a hair pick target resolves to its node id, not a hair id', () => {
    const model = baseModel()
    model.hairs = [makeHair({})]
    const { pickTargets } = buildFilamentsGeometry(model, new Map([['hypha-pr1', 0]]))
    expect(pickTargets).toHaveLength(1)
    expect(pickTargets[0]!.id).toBe('node-1')
  })

  it('drops a hair whose base sits before its hypha conduit split (time honesty)', () => {
    const hypha: Hypha = {
      id: 'hypha-pr1',
      kind: 'merged',
      ref: { type: 'pull_request', id: '1' },
      time: 90,
      parentHyphaId: null,
      splitTime: 90,
      endTime: 100,
      status: 'fused',
      points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.02, time: 90 }],
      lane: 0,
      side: 0,
      commitCount: 1,
      attachment: 'colony',
    }
    const model = baseModel()
    model.hyphae = [hypha]
    // Hair sits right at the spore (disc radius 0) -- inside the conduit.
    model.hairs = [makeHair({ position: { x: 0, y: 0, z: 0 } })]
    const { geometry } = buildFilamentsGeometry(model, new Map([['hypha-pr1', 0]]))
    expect(geometry.getAttribute('position').count).toBe(0)
  })

  it('includes fusion bridges as additional segments', () => {
    const model = baseModel()
    const fusion: Fusion = {
      id: 'fusion-hypha-pr1',
      kind: 'fusion',
      hyphaId: 'hypha-pr1',
      time: 50,
      ref: { type: 'pull_request', id: '1' },
      position: { x: 2, y: 0, z: 0 },
      bridgeTo: { x: 2.1, y: 0, z: 0.1 },
      bridgeToKind: 'hypha',
    }
    model.fusions = [fusion]
    const { geometry } = buildFilamentsGeometry(model, new Map())
    expect(geometry.getAttribute('position').count).toBe(2)
  })

  it('never produces NaN/non-finite attributes', () => {
    const model = baseModel()
    model.hairs = [makeHair({})]
    model.fusions = [
      {
        id: 'fusion-hypha-pr1',
        kind: 'fusion',
        hyphaId: 'hypha-pr1',
        time: 50,
        ref: { type: 'pull_request', id: '1' },
        position: { x: 2, y: 0, z: 0 },
        bridgeTo: { x: 2.1, y: 0, z: 0.1 },
        bridgeToKind: 'hypha',
      },
    ]
    const { geometry } = buildFilamentsGeometry(model, new Map([['hypha-pr1', 0]]))
    for (const name of ['position', 'color', 'alpha', 'birthTime', 'hyphaIndex', 'crossU', 'brightness']) {
      const attr = geometry.getAttribute(name)
      for (let i = 0; i < attr.array.length; i++) expect(Number.isFinite(attr.array[i])).toBe(true)
    }
  })
})
