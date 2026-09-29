import { discRadius, radiusForFrac, timeToFrac } from './ringGeometry'
import type { Hypha } from './types'
import type { TimeBounds } from '../shared/types'

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
