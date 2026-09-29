import { describe, expect, it } from 'vitest'
import type { Hypha, NetworkModel } from '../../../../domain/network'
import { buildHyphaeGeometry, hashNoise, renderableHyphae, tipTaperFactor } from './hyphaeGeometry'

function makeHypha(overrides: Partial<Hypha>): Hypha {
  return {
    id: 'hypha-pr1',
    kind: 'merged',
    ref: { type: 'pull_request', id: '1' },
    time: 0,
    parentHyphaId: 'hypha-main',
    splitTime: 0,
    endTime: 100,
    status: 'fused',
    points: [
      { position: { x: 0, y: 0, z: 0 }, radius: 0.02, time: 0 },
      { position: { x: 1, y: 0, z: 0 }, radius: 0.015, time: 50 },
      { position: { x: 2, y: 0, z: 0 }, radius: 0.01, time: 100 },
    ],
    lane: 0,
    side: 1,
    commitCount: 3,
    attachment: 'parent-branch',
    ...overrides,
  }
}

function makeModel(hyphae: Hypha[]): NetworkModel {
  return {
    seed: 'test/repo',
    layout: 'colony',
    bounds: { time: { firstEventTime: 0, lastEventTime: 100 }, radius: 5 },
    spore: { id: 'spore', kind: 'spore', time: 0, ref: { type: 'repo', id: 'test/repo' }, position: { x: 0, y: 0, z: 0 } },
    hyphae,
    nodes: [],
    tips: [],
    mushrooms: [],
    hairs: [],
    rings: [],
    fusions: [],
    overflow: { hyphaeOmitted: 0, nodesOmittedByHypha: {} },
    summary: {
      hyphaCountByKind: { main: 0, merged: 1, closed: 0, open: 0, liveBranch: 0, direct: 0 },
      nodeCount: 0,
      mushroomCount: 0,
      hairCount: 0,
      fusionCount: 0,
    },
  }
}

describe('renderableHyphae', () => {
  it('excludes the colony layout degenerate main stub', () => {
    const main = makeHypha({ id: 'hypha-main', kind: 'main', attachment: null, points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 0 }, { position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 0 }] })
    const pr = makeHypha({})
    const model = makeModel([main, pr])
    const result = renderableHyphae(model)
    expect(result.map((h) => h.id)).toEqual(['hypha-pr1'])
  })

  it('excludes hyphae with fewer than 2 points', () => {
    const degenerate = makeHypha({ id: 'hypha-pr2', points: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.01, time: 0 }] })
    const model = makeModel([degenerate])
    expect(renderableHyphae(model)).toEqual([])
  })
})

describe('tipTaperFactor', () => {
  it('never tapers a single-segment polyline (too short to taper without fully degenerating)', () => {
    for (let count = 0; count < 3; count++) {
      for (let i = 0; i < count; i++) expect(tipTaperFactor(i, count)).toBe(1)
    }
  })

  // M3c regression: a short hypha (as few as 2 segments / 3 points) used to
  // render as a constant-width, hard-square-ended ribbon -- a real "blocky
  // rectangle" visual artifact at the colony's rim, since short/low-work
  // hyphae are common there. Every polyline with >= 3 points must now taper
  // its own endpoint(s) toward 0, not just long ones.
  it('tapers a short polyline (3-5 points) toward its own endpoints instead of staying a constant-width block', () => {
    for (let count = 3; count < 6; count++) {
      expect(tipTaperFactor(0, count)).toBeLessThan(1)
      expect(tipTaperFactor(count - 1, count)).toBeLessThan(1)
    }
  })

  it('tapers exactly to 0 at both very ends of a long-enough polyline', () => {
    expect(tipTaperFactor(0, 12)).toBe(0)
    expect(tipTaperFactor(11, 12)).toBe(0)
  })

  it('is 1 (no taper) well inside the polyline', () => {
    expect(tipTaperFactor(6, 12)).toBe(1)
  })

  it('is symmetric between the start and end tapers', () => {
    expect(tipTaperFactor(1, 12)).toBeCloseTo(tipTaperFactor(10, 12), 10)
    expect(tipTaperFactor(2, 12)).toBeCloseTo(tipTaperFactor(9, 12), 10)
  })

  it('is monotonically non-decreasing from the start toward the middle', () => {
    const count = 20
    let previous = -1
    for (let i = 0; i <= count / 2; i++) {
      const value = tipTaperFactor(i, count)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('stays within [0, 1] for a wide range of polyline lengths', () => {
    for (let count = 6; count <= 40; count++) {
      for (let i = 0; i < count; i++) {
        const value = tipTaperFactor(i, count)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('hashNoise', () => {
  it('is deterministic for the same seed', () => {
    expect(hashNoise(42.7)).toBe(hashNoise(42.7))
  })

  it('stays within [0, 1)', () => {
    for (let seed = 0; seed < 200; seed += 0.37) {
      const value = hashNoise(seed)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('varies across different seeds (not a constant function)', () => {
    const values = new Set<number>()
    for (let seed = 0; seed < 20; seed++) values.add(hashNoise(seed))
    expect(values.size).toBeGreaterThan(1)
  })
})

describe('buildHyphaeGeometry', () => {
  it('produces one hyphaIndex per hypha and a consistent vertex count', () => {
    const model = makeModel([makeHypha({})])
    const { geometry, hyphaIndexById, pickTargets } = buildHyphaeGeometry(model)
    expect(hyphaIndexById.get('hypha-pr1')).toBe(0)
    // 2 vertices per point, 3 points.
    expect(geometry.getAttribute('position').count).toBe(6)
    expect(geometry.getAttribute('hyphaIndex').count).toBe(6)
    // Every vertex belongs to hypha index 0.
    const hyphaIndexAttr = geometry.getAttribute('hyphaIndex')
    for (let i = 0; i < hyphaIndexAttr.count; i++) expect(hyphaIndexAttr.getX(i)).toBe(0)
    // 2 segments -> 2 pick targets.
    expect(pickTargets).toHaveLength(2)
    expect(pickTargets.every((target) => target.id === 'hypha-pr1')).toBe(true)
  })

  it('never produces NaN/non-finite positions or colors', () => {
    const model = makeModel([makeHypha({}), makeHypha({ id: 'hypha-pr2', kind: 'closed', status: 'dead_end' })])
    const { geometry } = buildHyphaeGeometry(model)
    for (const name of ['position', 'color', 'alpha', 'birthTime', 'hyphaIndex', 'crossU', 'brightness']) {
      const attr = geometry.getAttribute(name)
      for (let i = 0; i < attr.array.length; i++) expect(Number.isFinite(attr.array[i])).toBe(true)
    }
  })

  it('assigns a low, faint alpha to a time-honesty conduit segment', () => {
    // A colony hypha that visually starts at the spore (disc radius 0) but
    // whose real splitTime is far into the repo's history -- an honesty gap.
    const hypha = makeHypha({
      attachment: 'colony',
      splitTime: 90,
      endTime: 100,
      points: [
        { position: { x: 0, y: 0, z: 0 }, radius: 0.02, time: 90 },
        { position: { x: 5, y: 0, z: 0 }, radius: 0.01, time: 100 },
      ],
    })
    const model = makeModel([hypha])
    model.bounds.time = { firstEventTime: 0, lastEventTime: 100 }
    const { geometry } = buildHyphaeGeometry(model)
    const alphaAttr = geometry.getAttribute('alpha')
    // First vertex pair (at the spore, disc radius 0) should be the faint conduit.
    expect(alphaAttr.getX(0)).toBeLessThan(0.3)
  })

  it('gives each hypha kind a distinct base color', () => {
    const merged = makeHypha({ id: 'a', kind: 'merged' })
    const closed = makeHypha({ id: 'b', kind: 'closed' })
    const model = makeModel([merged, closed])
    const { geometry } = buildHyphaeGeometry(model)
    const color = geometry.getAttribute('color')
    // First hypha's first vertex vs. second hypha's first vertex (index 6, 2 verts/point * 3 points offset).
    const r1 = color.getX(0)
    const r2 = color.getX(6)
    expect(r1).not.toBeCloseTo(r2, 3)
  })
})
