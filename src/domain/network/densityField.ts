/**
 * Unit 3 ("let the substrate emerge from the mycelium"): a low-resolution
 * density + birth-time field rasterized from the colony's own hyphae,
 * hairs, mushrooms and spore -- replaces the fixed geometric soil disc.
 * Sampled by a shader (`substrateMaterial.ts`) into a soft, low-contrast
 * additive haze whose silhouette is therefore organic and irregular (dense
 * where the colony is dense, near-background far from any hypha), and
 * whose reveal is keyed to each texel's own earliest contributing growth
 * time -- so the haze visibly grows alongside the hyphae during playback,
 * not as a static backdrop. Pure -- no React, no three.js.
 */
import type { NetworkModel } from './types'

/**
 * How far past the model's own tightest bounding radius the field extends.
 * Deliberately much wider than the old soil disc's own tight 1.12 margin:
 * since real structure (hair tips especially) can sit right at the model's
 * own reported bounding radius, a tight margin left too little ROOM for
 * density to genuinely taper to near-zero before the mesh's true (circular)
 * edge -- a wide margin instead gives the outer band real empty space to
 * fade through, so the substrate's edge reads as a soft haze dissolving
 * into the background rather than a disc with a defined boundary.
 */
export const DENSITY_FIELD_MARGIN = 1.6

/** Grid resolution (texels per side). Low on purpose -- a soft, low-contrast haze reads better blurred than crisp, and this keeps rasterization cheap even for a 1000+-hypha repo. */
export const DENSITY_FIELD_RESOLUTION = 96

/** Gaussian splat radius, in texels, for a single contributing point. */
const SPLAT_RADIUS_TEXELS = 2
/** A wider, stronger splat for the spore -- the colony's own origin should read as a small, denser core even when very few hyphae have grown yet. */
const SPORE_SPLAT_RADIUS_TEXELS = 4
const SPORE_SPLAT_WEIGHT = 2.2
const HAIR_SPLAT_WEIGHT = 0.45
const MUSHROOM_SPLAT_WEIGHT = 0.8
const NODE_SPLAT_WEIGHT = 1

export interface DensityField {
  resolution: number
  /** The field covers world-space `[-radius, radius]` on both X and Z. */
  radius: number
  /** `resolution * resolution`, row-major (z-major, then x), raw (unnormalized, non-negative) accumulated weight. */
  raw: Float32Array
  /** Same layout, `raw` clamped into `[0, 1]` -- `raw` is already bounded by the largest single splat weight (MAX accumulation, not summed), so this only guards against a texel touched solely by the highest-weight source (the spore). */
  density: Float32Array
  /** Same layout: the epoch-ms time of whichever contribution actually WINS this texel's `raw` max (see `splat`'s doc comment), `Number.POSITIVE_INFINITY` where nothing has ever contributed. */
  birthTime: Float32Array
}

function splat(
  raw: Float32Array,
  birthTime: Float32Array,
  resolution: number,
  radius: number,
  x: number,
  z: number,
  time: number,
  weight: number,
  spreadTexels: number,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(time)) return
  const cell = (2 * radius) / resolution
  const gx = (x + radius) / cell
  const gz = (z + radius) / cell
  const cx = Math.round(gx)
  const cz = Math.round(gz)
  const sigma2 = Math.max(spreadTexels * spreadTexels * 0.5, 1e-6)

  for (let dz = -spreadTexels; dz <= spreadTexels; dz++) {
    const iz = cz + dz
    if (iz < 0 || iz >= resolution) continue
    for (let dx = -spreadTexels; dx <= spreadTexels; dx++) {
      const ix = cx + dx
      if (ix < 0 || ix >= resolution) continue
      const dist2 = dx * dx + dz * dz
      const falloff = Math.exp(-dist2 / sigma2)
      if (falloff < 1e-4) continue
      const idx = iz * resolution + ix
      // MAX, not sum: a texel's density reflects "how close is the NEAREST
      // real structure", not an accumulated point count. Summing (an
      // earlier attempt) saturated almost the entire disc solid for any
      // repo with more than a couple hundred rendered points -- a single
      // hypha alone samples dozens of points along its own curve, all
      // landing in/near the same few texels, so summed weight blew up into
      // the hundreds/thousands well before reaching the disc's edge.
      // birthTime is tied to whichever contribution actually WINS the max
      // for `raw` at this texel, not an independent all-time minimum: an
      // old, faint, barely-reaching splat must never make a texel whose
      // VISIBLE density is dominated by a much newer, closer splat reveal
      // as if it were that old -- growth reveal has to follow what's
      // actually shown there, not merely "the earliest thing that ever
      // touched it". Ties (equal weighted falloff, e.g. two points at the
      // same distance) keep the earlier time, which is harmless either way.
      const contribution = weight * falloff
      if (contribution > raw[idx]!) {
        raw[idx] = contribution
        birthTime[idx] = time
      } else if (contribution === raw[idx] && time < birthTime[idx]!) {
        birthTime[idx] = time
      }
    }
  }
}

/** Builds the density/birth-time field for `model` at `resolution` texels/side. Deterministic (same model -> identical field). */
export function buildDensityField(model: NetworkModel, resolution: number = DENSITY_FIELD_RESOLUTION): DensityField {
  const radius = Math.max(model.bounds.radius, 0.5) * DENSITY_FIELD_MARGIN
  const size = resolution * resolution
  const raw = new Float32Array(size)
  const birthTime = new Float32Array(size).fill(Number.POSITIVE_INFINITY)

  splat(raw, birthTime, resolution, radius, model.spore.position.x, model.spore.position.z, model.spore.time, SPORE_SPLAT_WEIGHT, SPORE_SPLAT_RADIUS_TEXELS)

  for (const hypha of model.hyphae) {
    if (hypha.kind === 'main') continue // degenerate spore-origin entry, not a rendered curve
    for (const point of hypha.points) {
      splat(raw, birthTime, resolution, radius, point.position.x, point.position.z, point.time, NODE_SPLAT_WEIGHT, SPLAT_RADIUS_TEXELS)
    }
  }

  for (const hair of model.hairs) {
    const tipX = hair.position.x + hair.direction.x * hair.length
    const tipZ = hair.position.z + hair.direction.z * hair.length
    const midX = (hair.position.x + tipX) / 2
    const midZ = (hair.position.z + tipZ) / 2
    splat(raw, birthTime, resolution, radius, midX, midZ, hair.time, HAIR_SPLAT_WEIGHT, SPLAT_RADIUS_TEXELS)
  }

  for (const mushroom of model.mushrooms) {
    splat(raw, birthTime, resolution, radius, mushroom.position.x, mushroom.position.z, mushroom.time, MUSHROOM_SPLAT_WEIGHT, SPLAT_RADIUS_TEXELS)
  }

  const density = new Float32Array(size)
  for (let i = 0; i < size; i++) density[i] = Math.min(1, raw[i]!)

  return { resolution, radius, raw, density, birthTime }
}

/** The substrate haze's own world-space radius for a model -- the SAME margin `buildDensityField` uses, exposed separately so camera framing (`CameraRig`, via `NetworkSceneContent`) doesn't need to build a full field just for one number. */
export function substrateRadiusFor(model: NetworkModel): number {
  return Math.max(model.bounds.radius, 0.5) * DENSITY_FIELD_MARGIN
}
