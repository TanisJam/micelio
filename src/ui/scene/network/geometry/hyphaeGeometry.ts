import * as THREE from 'three'
import { conduitSplitRadius, discRadius, type Hypha, type NetworkModel } from '../../../../domain/network'
import type { TimeBounds } from '../../../../domain/tree'
import { hexToRgb } from '../../../theme/color'
import type { PickTarget } from '../picking/pickingGrid'
import { hyphaColorAt } from './colors'

/**
 * Batched hyphae geometry (P12): every hypha's tapered ribbon merged into
 * ONE `BufferGeometry`/draw call, instead of one mesh per hypha (which would
 * blow the draw-call budget for a 500+-hypha repo). A flat XZ-plane ribbon
 * (2 vertices per cross-section, `RIBBON_WIDTH_SCALE * point.radius` wide,
 * tapering base -> tip per the model's own real per-point thickness) reads
 * fine from the scene's 3/4 top-down camera and is far cheaper than a true
 * radial tube.
 *
 * Growth (T5) and the hover/select highlight (P7) are both driven by a
 * shader (see `growthMaterial.ts`) reading per-vertex `birthTime`/
 * `hyphaIndex`/`active` attributes against uniforms updated once per frame --
 * never by rebuilding this geometry.
 */

export const RIBBON_WIDTH_SCALE = 4.5
const MIN_HALF_WIDTH = 0.003
/** Alpha baked into a "time-honesty conduit" segment (see `conduitSplitRadius`) -- faint, never fully hidden. */
const CONDUIT_ALPHA = 0.1
/**
 * Base (unselected/unhovered) alpha range, base -> tip. Deliberately modest:
 * hyphae render additively blended (P2: "translucent/additive where they
 * overlap"), and a dense colony can stack hundreds of overlapping strands --
 * a round-1 visual QA finding (M3) was that a higher base alpha (0.6-1.0)
 * accumulated into an overexposed white haze across the whole disc instead
 * of reading as individually legible glowing filaments. Selecting an
 * element still boosts it well past this range (see `growthMaterial.ts`).
 */
const BASE_ALPHA_MIN = 0.16
const BASE_ALPHA_MAX = 0.4

export interface HyphaeGeometryResult {
  geometry: THREE.BufferGeometry
  /** Stable per-hypha integer index (as used by the `hyphaIndex` vertex attribute), for the highlight uniform. */
  hyphaIndexById: Map<string, number>
  pickTargets: PickTarget[]
}

function perpendicularXZ(tangentX: number, tangentZ: number): [number, number] {
  const length = Math.hypot(tangentX, tangentZ)
  if (length < 1e-9) return [1, 0]
  return [-tangentZ / length, tangentX / length]
}

/** Renderable hyphae: every real filament except the colony layout's degenerate lookup-only `main` stub (never drawn -- see `network-svg.ts`'s own precedent). */
export function renderableHyphae(model: NetworkModel): Hypha[] {
  return model.hyphae.filter((hypha) => !(hypha.kind === 'main' && model.layout === 'colony') && hypha.points.length >= 2)
}

export function buildHyphaeGeometry(model: NetworkModel): HyphaeGeometryResult {
  const hyphae = renderableHyphae(model)
  const bounds: TimeBounds = model.bounds.time

  const positions: number[] = []
  const colors: number[] = []
  const alphas: number[] = []
  const birthTimes: number[] = []
  const hyphaIndices: number[] = []
  const progresses: number[] = []
  const flowFactors: number[] = []
  const indices: number[] = []
  const pickTargets: PickTarget[] = []
  const hyphaIndexById = new Map<string, number>()

  let vertexCursor = 0

  hyphae.forEach((hypha, hyphaIndex) => {
    hyphaIndexById.set(hypha.id, hyphaIndex)
    const splitR = conduitSplitRadius(hypha, bounds)
    const pointCount = hypha.points.length

    for (let i = 0; i < pointCount; i++) {
      const point = hypha.points[i]!
      const prev = hypha.points[Math.max(0, i - 1)]!
      const next = hypha.points[Math.min(pointCount - 1, i + 1)]!
      const tangentX = next.position.x - prev.position.x
      const tangentZ = next.position.z - prev.position.z
      const [perpX, perpZ] = perpendicularXZ(tangentX, tangentZ)

      const halfWidth = Math.max(MIN_HALF_WIDTH, point.radius * RIBBON_WIDTH_SCALE) / 2
      const t = pointCount > 1 ? i / (pointCount - 1) : 0
      const colorHex = hyphaColorAt(hypha.kind, t)
      const { r, g, b } = hexToRgb(colorHex)
      const isConduit = splitR !== null && discRadius(point.position) < splitR
      const alpha = isConduit ? CONDUIT_ALPHA : BASE_ALPHA_MIN + (BASE_ALPHA_MAX - BASE_ALPHA_MIN) * t
      // Flow pulses (P4) only travel along active/open hyphae, never a dry
      // closed-PR dead end or a faint time-honesty conduit segment.
      const flowFactor = !isConduit && hypha.kind !== 'closed' ? 1 : 0

      // Left vertex, then right vertex -- both rings of a cross-section.
      positions.push(
        point.position.x + perpX * halfWidth,
        point.position.y,
        point.position.z + perpZ * halfWidth,
        point.position.x - perpX * halfWidth,
        point.position.y,
        point.position.z - perpZ * halfWidth,
      )
      for (let side = 0; side < 2; side++) {
        colors.push(r / 255, g / 255, b / 255)
        alphas.push(alpha)
        birthTimes.push(point.time)
        hyphaIndices.push(hyphaIndex)
        progresses.push(t)
        flowFactors.push(flowFactor)
      }

      if (i < pointCount - 1) {
        const a = vertexCursor
        const b2 = a + 1
        const c = a + 2
        const d = a + 3
        indices.push(a, b2, c, c, b2, d)

        pickTargets.push({
          id: hypha.id,
          x1: point.position.x,
          z1: point.position.z,
          x2: hypha.points[i + 1]!.position.x,
          z2: hypha.points[i + 1]!.position.z,
        })
      }
      vertexCursor += 2
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1))
  geometry.setAttribute('birthTime', new THREE.Float32BufferAttribute(birthTimes, 1))
  geometry.setAttribute('hyphaIndex', new THREE.Float32BufferAttribute(hyphaIndices, 1))
  geometry.setAttribute('progress', new THREE.Float32BufferAttribute(progresses, 1))
  geometry.setAttribute('flowFactor', new THREE.Float32BufferAttribute(flowFactors, 1))
  geometry.setIndex(indices)

  return { geometry, hyphaIndexById, pickTargets }
}
