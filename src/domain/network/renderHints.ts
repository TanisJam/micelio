import { discRadius, radiusForFrac, timeToFrac } from './ringGeometry'
import type { Hypha } from './types'
import type { TimeBounds } from '../shared/types'
import { clamp, lerp } from '../math'

/**
 * M3 (rendering) pure honesty/growth helpers. No React, no three.js.
 *
 * TIME HONESTY (see `odd/tasks/huerto-mvp.md`'s M3 brief): a colony hypha can
 * visually sprout fresh from the spore (disc radius 0) for continuity, even
 * though its real `splitTime` corresponds to a later, nonzero disc radius
 * (see M2d's "spore-started colony hypha" case in `colonyLayout.ts`). Drawing
 * the whole thing at full brightness would imply "this branch existed since
 * the very first commit", which isn't true. `conduitSplitRadius` locates the
 * disc radius where an honest "just a visual anchor back to the spore" faint
 * conduit ends and the hypha's real, data-backed active growth begins.
 */

/** Disc radius (world units) below which a colony hypha's own polyline should render as a faint, hair-less conduit rather than an active/highlighted filament -- `null` when the whole hypha is honestly active (every other case: non-colony attachment, or a colony hypha that doesn't actually start at the spore). */
export function conduitSplitRadius(hypha: Hypha, bounds: TimeBounds): number | null {
  if (hypha.attachment !== 'colony') return null
  const first = hypha.points[0]
  if (!first) return null
  if (discRadius(first.position) > 1e-4) return null // didn't actually start at the spore -- no honesty gap to flag
  const r0 = radiusForFrac(timeToFrac(hypha.splitTime, bounds))
  if (r0 <= 1e-4) return null // split time is effectively the beginning; nothing dishonest about it
  return r0
}

/** True once `currentTime` has reached `birthTime` -- the growth-visibility rule shared by every network element kind (hypha point, hair, mushroom, fusion, tip). */
export function isGrown(birthTime: number, currentTime: number): boolean {
  return currentTime >= birthTime
}

/**
 * Overflow honesty (P12/M3b item 6): a quiet, singular/plural-correct note
 * for however many PR-derived hyphae the render cap omitted (`NetworkOverflow.hyphaeOmitted`,
 * see `buildNetwork.ts`), or `null` when nothing was omitted -- so the UI can
 * simply not render anything rather than branch on `0` itself. Deliberately
 * doesn't also fold in `nodesOmittedByHypha` (a different, per-hypha overflow
 * concern already surfaced honestly in `DetailPanel`'s PR detail, see
 * `elementDetail.ts`'s `overflowPrCount`) -- this note is specifically about
 * whole pull requests never drawn at all.
 */
export function formatOverflowNote(hyphaeOmitted: number): string | null {
  if (hyphaeOmitted <= 0) return null
  const noun = hyphaeOmitted === 1 ? 'pull request' : 'pull requests'
  return `+${hyphaeOmitted} ${noun} not drawn`
}

/**
 * Final polish pass, Unit 1 ("rim growth front"): the trailing fraction of
 * the whole time span whose hyphae count as still-young, still-forming
 * growth. Before this pass the colony's outer rim read as a "comb" -- a ring
 * of short, bright, fully-mature-looking strokes, because every hypha
 * (however recently split) rendered at the same width/brightness as an
 * old, settled one. Shared by `rimAgeStyle` below (render-time
 * width/brightness/color) and `colonyLayout.ts`'s `growHyphaPoints` (a small
 * seeded lateral curvature bias, item 1c of the brief) so both effects agree
 * on exactly which hyphae count as "recent".
 */
export const RECENT_GROWTH_FRACTION = 0.1

/**
 * 0 (not in the recent slice at all) .. 1 (the very last event in the whole
 * time span), eased quadratically so the effect stays negligible just inside
 * the slice boundary and concentrates close to "now" -- a soft gradient, not
 * a visible cliff at a fixed radius.
 */
export function recentGrowthFactor(time: number, bounds: TimeBounds): number {
  const frac = timeToFrac(time, bounds)
  const sliceStart = 1 - RECENT_GROWTH_FRACTION
  if (frac <= sliceStart) return 0
  const linear = clamp((frac - sliceStart) / RECENT_GROWTH_FRACTION, 0, 1)
  return linear * linear
}

export interface RimAgeStyle {
  /** `recentGrowthFactor`'s own output, passed through for callers that want it directly (e.g. to further shape a tip fade). */
  recency: number
  /** Multiplies the ribbon's rendered half-width; `1` outside the recent slice. */
  widthScale: number
  /** Multiplies the ribbon's rendered alpha; `1` outside the recent slice. */
  alphaScale: number
  /** 0 (this hypha's own kind color, untouched) .. 1 (fully blended toward the cool young-growth tint) -- see `hyphaeGeometry.ts`'s use of `mycelium.hyphaActiveTip`. */
  coolBlend: number
}

/** Thinnest a recent-slice hypha's own width is scaled to, at full recency (`recency === 1`) -- still a visible, deliberate thread, never invisible. */
const RIM_MIN_WIDTH_SCALE = 0.45
/** Dimmest a recent-slice hypha's own alpha is scaled to, at full recency. */
const RIM_MIN_ALPHA_SCALE = 0.55
/** Strongest cool-tint blend applied at full recency -- kept a partial blend (never 1.0) so a young hypha still visibly carries its own kind color (dead/open/merged), just cooled, not recolored outright. */
const RIM_MAX_COOL_BLEND = 0.55

/**
 * Render-time styling for a hypha whose SPLIT TIME falls in the trailing
 * `RECENT_GROWTH_FRACTION` of history: thinner, dimmer, and blended cooler --
 * together with the taper this pass already applies at every hypha's own
 * tip (`hyphaeGeometry.ts`'s `tipTaperFactor`), a recent hypha's already-
 * short rim segment ends up softly fading rather than reading as a solid,
 * fully-mature stroke. Deliberately keyed on SPLIT TIME (when the strand was
 * born), not on the point's own instantaneous growth-replay time -- a hypha
 * that finished growing long ago always reads mature, never "flickers" young
 * again as playback scrubs past it.
 */
export function rimAgeStyle(splitTime: number, bounds: TimeBounds): RimAgeStyle {
  const recency = recentGrowthFactor(splitTime, bounds)
  return {
    recency,
    widthScale: lerp(1, RIM_MIN_WIDTH_SCALE, recency),
    alphaScale: lerp(1, RIM_MIN_ALPHA_SCALE, recency),
    coolBlend: lerp(0, RIM_MAX_COOL_BLEND, recency),
  }
}
