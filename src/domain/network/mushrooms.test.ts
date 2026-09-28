import { describe, expect, it } from 'vitest'
import type { HyphaPoint } from './types'
import { buildMushrooms, buildMushroomsOnRings } from './mushrooms'

const MAIN_POINTS: HyphaPoint[] = [
  { position: { x: 0, y: 0, z: 0 }, radius: 0.1, time: 0 },
  { position: { x: 5, y: 0, z: 0 }, radius: 0.03, time: 1000 },
]

function release(tag: string, date: string, name: string | null = null) {
  return { name: name ?? tag, tag, date, url: `https://x/${tag}`, targetOid: null }
}

describe('buildMushrooms', () => {
  it('returns [] for no releases', () => {
    expect(buildMushrooms([], MAIN_POINTS, 'o/r')).toEqual([])
  })

  it('one mushroom per release, each with a real ref and a lifted position', () => {
    const releases = [release('v1.0.0', new Date(500).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    expect(mushrooms).toHaveLength(1)
    expect(mushrooms[0]!.ref).toEqual({ type: 'release', id: 'v1.0.0' })
    expect(mushrooms[0]!.position.y).toBeGreaterThan(0)
  })

  it('is deterministic for the same seed', () => {
    const releases = [release('v1.0.0', new Date(200).toISOString()), release('v1.0.1', new Date(210).toISOString())]
    expect(buildMushrooms(releases, MAIN_POINTS, 'o/r')).toEqual(buildMushrooms(releases, MAIN_POINTS, 'o/r'))
  })

  it('clusters releases close in time under a shared clusterId, and leaves distant ones standalone', () => {
    const closeTogether = [
      release('v1.0.0', new Date(0).toISOString()),
      release('v1.0.1', new Date(1000 * 60 * 60).toISOString()), // 1 hour later: clustered
    ]
    const farApart = [release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())] // ~400 days later: standalone
    const mushrooms = buildMushrooms([...closeTogether, ...farApart], MAIN_POINTS, 'o/r')

    const clustered = mushrooms.filter((m) => m.ref.id === 'v1.0.0' || m.ref.id === 'v1.0.1')
    expect(clustered[0]!.clusterId).not.toBeNull()
    expect(clustered[0]!.clusterId).toBe(clustered[1]!.clusterId)

    const standalone = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    expect(standalone.clusterId).toBeNull()
  })

  it('gives a bigger scale to a major release than a patch release', () => {
    const releases = [release('v2.0.0', new Date(0).toISOString()), release('v2.0.1', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    const major = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    const patch = mushrooms.find((m) => m.ref.id === 'v2.0.1')!
    expect(major.scale).toBeGreaterThan(patch.scale)
  })

  it('never produces NaN/Infinity, even for a non-semver tag', () => {
    const releases = [release('nightly-build', new Date(0).toISOString())]
    const mushrooms = buildMushrooms(releases, MAIN_POINTS, 'o/r')
    expect(Number.isFinite(mushrooms[0]!.scale)).toBe(true)
    expect(Number.isFinite(mushrooms[0]!.position.x)).toBe(true)
  })
})

describe('buildMushroomsOnRings (colony layout)', () => {
  const RADIUS_FOR_TIME = (time: number): number => 1 + time / 10000

  it('returns [] for no releases', () => {
    expect(buildMushroomsOnRings([], RADIUS_FOR_TIME, 'o/r')).toEqual([])
  })

  it('places each mushroom exactly at radiusForTime(its own release date)', () => {
    const releases = [release('v1.0.0', new Date(500).toISOString()), release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, 'o/r')
    for (const mushroom of mushrooms) {
      const radius = Math.hypot(mushroom.position.x, mushroom.position.z)
      expect(radius).toBeCloseTo(RADIUS_FOR_TIME(mushroom.time), 6)
    }
  })

  it('is deterministic for the same seed', () => {
    const releases = [release('v1.0.0', new Date(200).toISOString()), release('v1.0.1', new Date(210).toISOString())]
    expect(buildMushroomsOnRings(releases, RADIUS_FOR_TIME, 'o/r')).toEqual(buildMushroomsOnRings(releases, RADIUS_FOR_TIME, 'o/r'))
  })

  it('clusters releases close in time under a shared clusterId, and leaves distant ones standalone', () => {
    const closeTogether = [release('v1.0.0', new Date(0).toISOString()), release('v1.0.1', new Date(1000 * 60 * 60).toISOString())]
    const farApart = [release('v2.0.0', new Date(1000 * 60 * 60 * 24 * 400).toISOString())]
    const mushrooms = buildMushroomsOnRings([...closeTogether, ...farApart], RADIUS_FOR_TIME, 'o/r')
    const clustered = mushrooms.filter((m) => m.ref.id === 'v1.0.0' || m.ref.id === 'v1.0.1')
    expect(clustered[0]!.clusterId).not.toBeNull()
    expect(clustered[0]!.clusterId).toBe(clustered[1]!.clusterId)
    const standalone = mushrooms.find((m) => m.ref.id === 'v2.0.0')!
    expect(standalone.clusterId).toBeNull()
  })

  it('never produces NaN/Infinity', () => {
    const releases = [release('nightly-build', new Date(0).toISOString())]
    const mushrooms = buildMushroomsOnRings(releases, RADIUS_FOR_TIME, 'o/r')
    expect(Number.isFinite(mushrooms[0]!.position.x)).toBe(true)
    expect(Number.isFinite(mushrooms[0]!.position.z)).toBe(true)
  })
})
