import * as THREE from 'three'
import { conduitSplitRadius, discRadius, type Hypha, type NetworkModel } from '../../../../domain/network'
import type { TimeBounds } from '../../../../domain/tree'
import { hexToRgb } from '../../../theme/color'
import { mycelium } from '../../../theme/tokens'
import type { PickTarget } from '../picking/pickingGrid'

/**
 * Merged fine filament geometry: mycelial hairs (one per rendered commit
 * node, P3's "mycelial hair texture") and fusion "anastomosis bridges" (the
 * short link from a merged hypha's real tip to whichever nearby structure
 * it visually fuses into), rendered together as a single `THREE.LineSegments`
 * draw call -- both are thin, low-opacity texture (P12: keep draw calls low).
 *
 * A hair "decorates its already-lookupable `NetworkNode` via `nodeId`" (see
 * `types.ts`) rather than being independently selectable itself, so its
 * `PickTarget` resolves to the commit *node*'s id, not a hair id. Fusion
 * bridges aren't independently selectable at all (no `PickTarget` for them).
 *
 * TIME HONESTY (see `renderHints.conduitSplitRadius`): a hair whose base
 * sits on a colony hypha's faint "conduit back to the spore" segment is
 * dropped entirely -- "hairs (commits) only on the active part" per the M3
 * brief, not just dimmed.
 */

// Modest, same reasoning as `hyphaeGeometry.ts`'s `BASE_ALPHA_*` -- additive
// blending across a dense hair field overexposes fast if each one is too bright.
const HAIR_ALPHA = 0.18
const BRIDGE_ALPHA = 0.3

export interface FilamentsGeometryResult {
  geometry: THREE.BufferGeometry
  pickTargets: PickTarget[]
}

export function buildFilamentsGeometry(model: NetworkModel, hyphaIndexById: Map<string, number>): FilamentsGeometryResult {
  const bounds: TimeBounds = model.bounds.time
  const hyphaById = new Map<string, Hypha>(model.hyphae.map((hypha) => [hypha.id, hypha]))
  const conduitByHypha = new Map<string, number | null>()
  function splitFor(hyphaId: string): number | null {
    if (conduitByHypha.has(hyphaId)) return conduitByHypha.get(hyphaId)!
    const hypha = hyphaById.get(hyphaId)
    const split = hypha ? conduitSplitRadius(hypha, bounds) : null
    conduitByHypha.set(hyphaId, split)
    return split
  }

  const positions: number[] = []
  const colors: number[] = []
  const alphas: number[] = []
  const birthTimes: number[] = []
  const hyphaIndices: number[] = []
  const progresses: number[] = []
  const flowFactors: number[] = []
  // Hairs/bridges are simple line segments, not tapered ribbons -- the
  // shared `growthMaterial.ts` shader still reads `crossU`/`brightness` per
  // vertex (every mesh sharing one `ShaderMaterial`/program must populate
  // every attribute it declares, or WebGL reuses stale attribute state left
  // bound by whichever OTHER mesh using the same material drew last). `0`
  // keeps the cross-ribbon glow falloff a no-op (core = edgeFade = 1) and
  // `1` keeps the along-length brightness variation a no-op.
  const crossUs: number[] = []
  const brightnesses: number[] = []
  const pickTargets: PickTarget[] = []

  const hairColor = hexToRgb(mycelium.hyphaActiveTip)
  for (const hair of model.hairs) {
    const split = splitFor(hair.hyphaId)
    if (split !== null && discRadius(hair.position) < split) continue // time-honesty: no hairs on the faint conduit part

    const tipX = hair.position.x + hair.direction.x * hair.length
    const tipY = hair.position.y + hair.direction.y * hair.length
    const tipZ = hair.position.z + hair.direction.z * hair.length
    positions.push(hair.position.x, hair.position.y, hair.position.z, tipX, tipY, tipZ)
    const hyphaIndex = hyphaIndexById.get(hair.hyphaId) ?? -1
    for (let i = 0; i < 2; i++) {
      colors.push(hairColor.r / 255, hairColor.g / 255, hairColor.b / 255)
      alphas.push(HAIR_ALPHA)
      birthTimes.push(hair.time)
      hyphaIndices.push(hyphaIndex)
      progresses.push(0)
      flowFactors.push(0)
      crossUs.push(0)
      brightnesses.push(1)
    }
    pickTargets.push({ id: hair.nodeId, x1: hair.position.x, z1: hair.position.z, x2: tipX, z2: tipZ })
  }

  const bridgeColor = hexToRgb(mycelium.fusion)
  for (const fusion of model.fusions) {
    positions.push(fusion.position.x, fusion.position.y, fusion.position.z, fusion.bridgeTo.x, fusion.bridgeTo.y, fusion.bridgeTo.z)
    const hyphaIndex = hyphaIndexById.get(fusion.hyphaId) ?? -1
    for (let i = 0; i < 2; i++) {
      colors.push(bridgeColor.r / 255, bridgeColor.g / 255, bridgeColor.b / 255)
      alphas.push(BRIDGE_ALPHA)
      birthTimes.push(fusion.time)
      hyphaIndices.push(hyphaIndex)
      progresses.push(0)
      flowFactors.push(0)
      crossUs.push(0)
      brightnesses.push(1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1))
  geometry.setAttribute('birthTime', new THREE.Float32BufferAttribute(birthTimes, 1))
  geometry.setAttribute('hyphaIndex', new THREE.Float32BufferAttribute(hyphaIndices, 1))
  geometry.setAttribute('progress', new THREE.Float32BufferAttribute(progresses, 1))
  geometry.setAttribute('flowFactor', new THREE.Float32BufferAttribute(flowFactors, 1))
  geometry.setAttribute('crossU', new THREE.Float32BufferAttribute(crossUs, 1))
  geometry.setAttribute('brightness', new THREE.Float32BufferAttribute(brightnesses, 1))

  return { geometry, pickTargets }
}
