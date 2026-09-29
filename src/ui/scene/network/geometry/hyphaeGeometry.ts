import * as THREE from 'three'
import { conduitSplitRadius, discRadius, rimAgeStyle, type Hypha, type NetworkModel } from '../../../../domain/network'
import type { TimeBounds } from '../../../../domain/shared'
import { hexToRgb, mixHex } from '../../../theme/color'
import { mycelium } from '../../../theme/tokens'
import type { PickTarget } from '../picking/pickingGrid'
import { hyphaColorAt } from './colors'

/**
 * Batched hyphae geometry (P12): every hypha's tapered TUBE merged into ONE
 * `BufferGeometry`/draw call, instead of one mesh per hypha (which would
 * blow the draw-call budget for a 500+-hypha repo). Galaxy-3d: the colony
 * is now genuinely volumetric (hyphae climb/dip inside a bulge), so a flat
 * XZ ribbon would read as a sliver from the side -- each cross-section is a
 * small ring of `radialSegments` vertices (`RIBBON_WIDTH_SCALE *
 * point.radius` wide, tapering base -> tip per the model's own real
 * per-point thickness). The glow profile the ribbon got from its `crossU`
 * attribute is recomputed per view in the shader from each vertex's
 * `tubeNormal` (see `growthMaterial.ts`'s `TUBE` define), so a strand reads
 * as the same thin luminous thread from any angle.
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
/** Default radial segments per tube cross-section (desktop). */
export const TUBE_RADIAL_SEGMENTS = 6
/** Coarser LOD for small/mobile viewports -- still round enough at phone scale, ~1/3 fewer vertices. */
export const TUBE_RADIAL_SEGMENTS_LOW = 4
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

/**
 * A cross-section frame `(n, b)` perpendicular to tangent `t`: `n` is the
 * horizontal side vector (tangent x world-up), `b` completes a right-handed
 * `(n, b, t)` basis. Hyphae are never close to vertical, so world-up is a
 * stable reference (no twisting along a strand); a degenerate tangent falls
 * back to a fixed frame.
 */
export function tubeFrame(tx: number, ty: number, tz: number): { n: [number, number, number]; b: [number, number, number] } {
  const tLength = Math.hypot(tx, ty, tz)
  if (tLength < 1e-9) return { n: [1, 0, 0], b: [0, 1, 0] }
  const ux = tx / tLength
  const uy = ty / tLength
  const uz = tz / tLength
  // n = t x up = (-tz, 0, tx)
  let nx = -uz
  let ny = 0
  let nz = ux
  let nLength = Math.hypot(nx, ny, nz)
  if (nLength < 1e-6) {
    // Tangent is (anti)parallel to up: use t x X instead.
    nx = 0
    ny = uz
    nz = -uy
    nLength = Math.hypot(nx, ny, nz)
  }
  nx /= nLength
  ny /= nLength
  nz /= nLength
  // b = t x n
  const bx = uy * nz - uz * ny
  const by = uz * nx - ux * nz
  const bz = ux * ny - uy * nx
  return { n: [nx, ny, nz], b: [bx, by, bz] }
}

export interface HyphaeGeometryOptions {
  /** Vertices per tube cross-section (>= 3). Defaults to `TUBE_RADIAL_SEGMENTS`. */
  radialSegments?: number
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

export function buildHyphaeGeometry(model: NetworkModel, options: HyphaeGeometryOptions = {}): HyphaeGeometryResult {
  const radialSegments = Math.max(3, Math.round(options.radialSegments ?? TUBE_RADIAL_SEGMENTS))
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
  const tubeNormals: number[] = []
  const tubeTangents: number[] = []
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
      const tx = next.position.x - prev.position.x
      const ty = next.position.y - prev.position.y
      const tz = next.position.z - prev.position.z
      const { n, b: binormal } = tubeFrame(tx, ty, tz)
      const tLength = Math.hypot(tx, ty, tz) || 1

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

      // One ring of `radialSegments` vertices around the centerline.
      for (let k = 0; k < radialSegments; k++) {
        const angle = (k / radialSegments) * Math.PI * 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const dx = n[0] * cos + binormal[0] * sin
        const dy = n[1] * cos + binormal[1] * sin
        const dz = n[2] * cos + binormal[2] * sin
        positions.push(point.position.x + dx * halfWidth, point.position.y + dy * halfWidth, point.position.z + dz * halfWidth)
        tubeNormals.push(dx, dy, dz)
        tubeTangents.push(tx / tLength, ty / tLength, tz / tLength)
        colors.push(r / 255, g / 255, b / 255)
        alphas.push(alpha)
        birthTimes.push(point.time)
        hyphaIndices.push(hyphaIndex)
        progresses.push(t)
        flowFactors.push(flowFactor)
        // The ribbon's across-width coordinate; unused by the tube shader
        // path (it derives the profile per view from `tubeNormal`).
        crossUs.push(cos)
        brightnesses.push(brightness)
      }

      if (i < pointCount - 1) {
        // Outward-facing winding (the tube material is front-side only):
        // (a, c, b) + (c, d, b) with a/c on this ring, b/d on the next.
        for (let k = 0; k < radialSegments; k++) {
          const kNext = (k + 1) % radialSegments
          const a = vertexCursor + k
          const c = vertexCursor + kNext
          const b2 = vertexCursor + radialSegments + k
          const d = vertexCursor + radialSegments + kNext
          indices.push(a, c, b2, c, d, b2)
        }

        pickTargets.push({
          id: hypha.id,
          x1: point.position.x,
          y1: point.position.y,
          z1: point.position.z,
          x2: hypha.points[i + 1]!.position.x,
          y2: hypha.points[i + 1]!.position.y,
          z2: hypha.points[i + 1]!.position.z,
          visibleAt: Math.max(point.time, hypha.points[i + 1]!.time),
        })
      }
      vertexCursor += radialSegments
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
  geometry.setAttribute('tubeNormal', new THREE.Float32BufferAttribute(tubeNormals, 3))
  geometry.setAttribute('tubeTangent', new THREE.Float32BufferAttribute(tubeTangents, 3))
  geometry.setAttribute('brightness', new THREE.Float32BufferAttribute(brightnesses, 1))
  geometry.setIndex(indices)

  return { geometry, hyphaIndexById, pickTargets }
}
