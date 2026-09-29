import * as THREE from 'three'
import { conduitSplitRadius, discRadius, rimAgeStyle, type Hypha, type NetworkModel } from '../../../../domain/network'
import type { TimeBounds } from '../../../../domain/shared'
import { hexToRgb, mixHex } from '../../../theme/color'
import { mycelium } from '../../../theme/tokens'
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

export const RIBBON_WIDTH_SCALE = 5
const MIN_HALF_WIDTH = 0.003
/** Alpha baked into a "time-honesty conduit" segment (see `conduitSplitRadius`) -- faint, never fully hidden. */
const CONDUIT_ALPHA = 0.1
/** Fraction of the ribbon's own half-width added/subtracted as a per-side Y offset (P3 "tiny y-thickness variation so arms have depth when orbiting") -- a shallow "tent" cross-section, invisible from directly overhead but giving the strand real volume once the camera orbits off-axis. */
const CROSS_Y_TILT = 0.35
/**
 * Taper span at EACH end of a hypha's polyline, as a fraction of its own
 * total sample count (P3 "rounded/tapered tips to zero width, no square
 * caps") -- proportional, not a fixed few samples, so a long arm tapers
 * over a visibly long stretch rather than just its last couple of vertices
 * (an M3b round-2 visual finding: a too-short taper still bloomed into a
 * fuzzy "blocky" cap, since the ribbon stayed near full width/brightness
 * almost all the way to a very-last-moment point). Floored at
 * `MIN_TAPER_POINTS` samples so a shorter hypha still visibly tapers.
 * Hyphae with fewer than `MIN_POINTS_TO_TAPER` samples skip tapering
 * entirely so a short/synthetic polyline never fully degenerates.
 */
const TAPER_FRACTION = 0.18
const MIN_TAPER_POINTS = 3
/**
 * Base (unselected/unhovered) alpha range, base -> tip. Deliberately modest:
 * hyphae render additively blended (P2: "translucent/additive where they
 * overlap"), and a dense colony can stack hundreds of overlapping strands --
 * a round-1 visual QA finding (M3) was that a higher base alpha (0.6-1.0)
 * accumulated into an overexposed white haze across the whole disc instead
 * of reading as individually legible glowing filaments. Selecting an
 * element still boosts it well past this range (see `growthMaterial.ts`).
 */
// M3c item 2: bumped from 0.16/0.4 -- the M3b brightness pass (this range's
// prior values) read noticeably dimmer/flatter than the pre-M3b galaxy
// (commit 1dd7a8f), per the orchestrator's screenshot review. Still modest
// relative to a selected hypha's own much brighter highlight (see
// `growthMaterial.ts`), and still additive (a dense colony's overlap keeps
// doing the rest of the brightening).
const BASE_ALPHA_MIN = 0.22
const BASE_ALPHA_MAX = 0.52

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

/**
 * Smoothstep-eased taper toward zero width at both ends of a hypha's own
 * polyline (`index`/`count`), over the nearest `span` samples -- `1` (no
 * taper) everywhere else.
 *
 * M3c real bug found and fixed (rim-artifact visual finding, item 3): this
 * used to skip tapering ENTIRELY (return `1` everywhere) for any hypha with
 * fewer than `MIN_POINTS_TO_TAPER` (6) points -- a short, low-work hypha
 * (few commits, common near the disc's outer rim) renders as a
 * constant-width, constant-alpha ribbon with hard square ends instead of a
 * fine tapered thread, additively blooming into exactly the "blocky white/
 * cyan rectangle" fragments the orchestrator's screenshot review flagged.
 * Every polyline with at least 3 points (2 segments) can taper its own
 * endpoints without fully degenerating (`span` is capped at
 * `floor((count-1)/2)`, so the two tapered halves never overlap); only a
 * single-segment (`count < 3`) stub -- rare, and only a couple of world
 * units long regardless -- still renders at constant width.
 */
export function tipTaperFactor(index: number, count: number): number {
  if (count < 3) return 1
  const halfSpanCap = Math.max(1, Math.floor((count - 1) / 2))
  const proportional = Math.round((count - 1) * TAPER_FRACTION)
  const span = Math.min(Math.max(MIN_TAPER_POINTS, proportional), halfSpanCap)
  if (span <= 0) return 1
  const distanceFromNearestEnd = Math.min(index, count - 1 - index)
  if (distanceFromNearestEnd >= span) return 1
  const t = distanceFromNearestEnd / span
  return t * t * (3 - 2 * t)
}

/** Deterministic pseudo-noise in `[0, 1)` from a plain float seed -- a cheap, dependency-free hash (no PRNG state), used for the along-length brightness variation (P3 "slight brightness variation along length"). Pure and exported for testing. */
export function hashNoise(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  return s - Math.floor(s)
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
  const crossUs: number[] = []
  const brightnesses: number[] = []
  const indices: number[] = []
  const pickTargets: PickTarget[] = []
  const hyphaIndexById = new Map<string, number>()

  let vertexCursor = 0

  hyphae.forEach((hypha, hyphaIndex) => {
    hyphaIndexById.set(hypha.id, hyphaIndex)
    const splitR = conduitSplitRadius(hypha, bounds)
    const pointCount = hypha.points.length
    // Unit 1a of the final polish pass ("rim growth front"): keyed on the
    // hypha's own split time (constant for the whole strand), not on
    // per-point growth-replay time -- see `rimAgeStyle`'s own doc comment.
    const ageStyle = rimAgeStyle(hypha.splitTime, bounds)

    for (let i = 0; i < pointCount; i++) {
      const point = hypha.points[i]!
      const prev = hypha.points[Math.max(0, i - 1)]!
      const next = hypha.points[Math.min(pointCount - 1, i + 1)]!
      const tangentX = next.position.x - prev.position.x
      const tangentZ = next.position.z - prev.position.z
      const [perpX, perpZ] = perpendicularXZ(tangentX, tangentZ)

      const taper = tipTaperFactor(i, pointCount)
      const halfWidth = (Math.max(MIN_HALF_WIDTH, point.radius * RIBBON_WIDTH_SCALE) * taper * ageStyle.widthScale) / 2
      const t = pointCount > 1 ? i / (pointCount - 1) : 0
      const colorHexBase = hyphaColorAt(hypha.kind, t)
      // Recent-slice (rim, still-young) hyphae blend cooler toward the
      // palette's own "active/cool cyan" tone (Unit 1a) -- a partial blend
      // (`ageStyle.coolBlend` never reaches 1), so a young hypha still
      // visibly carries its own kind color, just cooled.
      const colorHex = ageStyle.coolBlend > 0 ? mixHex(colorHexBase, mycelium.hyphaActiveTip, ageStyle.coolBlend) : colorHexBase
      const { r, g, b } = hexToRgb(colorHex)
      const isConduit = splitR !== null && discRadius(point.position) < splitR
      const baseAlpha = isConduit ? CONDUIT_ALPHA : BASE_ALPHA_MIN + (BASE_ALPHA_MAX - BASE_ALPHA_MIN) * t
      // Fade brightness together with width toward each tip (not just width
      // alone) -- a narrow-but-still-full-alpha near-tip segment still
      // bloomed into a small bright blob (round-2 visual finding), reading
      // as a "cap" even once the geometry itself tapered to a point.
      // Unit 1a additionally dims a recent-slice hypha's own alpha
      // (`ageStyle.alphaScale`) so its already-tapered tip fades into a soft
      // halo rather than staying full-bright right up to the taper.
      const alpha = baseAlpha * taper * ageStyle.alphaScale
      // Flow pulses (P4) only travel along active/open hyphae, never a dry
      // closed-PR dead end or a faint time-honesty conduit segment.
      const flowFactor = !isConduit && hypha.kind !== 'closed' ? 1 : 0
      // Slight along-length brightness variation (P3), deterministic per
      // hypha+sample so it never flickers/changes between renders.
      const brightness = 0.88 + 0.24 * hashNoise(hyphaIndex * 97.13 + i * 13.7)
      // A shallow Y "tent" across the ribbon's width, scaled by the same
      // taper as the width itself so a tapered-to-a-point tip never gets a
      // stray vertical kink (P3 "tiny y-thickness variation").
      const yTilt = halfWidth * CROSS_Y_TILT

      // Left vertex, then right vertex -- both rings of a cross-section.
      positions.push(
        point.position.x + perpX * halfWidth,
        point.position.y + yTilt,
        point.position.z + perpZ * halfWidth,
        point.position.x - perpX * halfWidth,
        point.position.y - yTilt,
        point.position.z - perpZ * halfWidth,
      )
      for (let side = 0; side < 2; side++) {
        colors.push(r / 255, g / 255, b / 255)
        alphas.push(alpha)
        birthTimes.push(point.time)
        hyphaIndices.push(hyphaIndex)
        progresses.push(t)
        flowFactors.push(flowFactor)
        crossUs.push(side === 0 ? -1 : 1)
        brightnesses.push(brightness)
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
          visibleAt: Math.max(point.time, hypha.points[i + 1]!.time),
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
  geometry.setAttribute('crossU', new THREE.Float32BufferAttribute(crossUs, 1))
  geometry.setAttribute('brightness', new THREE.Float32BufferAttribute(brightnesses, 1))
  geometry.setIndex(indices)

  return { geometry, hyphaIndexById, pickTargets }
}
