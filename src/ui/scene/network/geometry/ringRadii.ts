import type { GrowthRing } from '../../../../domain/network'

/**
 * Sorted, deduplicated ring radii for the soil shader's faint growth-ring
 * uniform array -- mirrors `network-svg.ts`'s render-time ring dedupe (M2d):
 * every release still gets its own real `GrowthRing` model entry (no data
 * lost), this only visually merges rings close enough to stack into one
 * overly bright band. Capped at `maxCount` (a fixed-size shader uniform
 * array), keeping the innermost rings (closest to the spore) when over cap.
 */
export function dedupeRingRadii(rings: GrowthRing[], epsilon: number, maxCount: number): number[] {
  const sorted = [...rings].map((ring) => ring.radius).sort((a, b) => a - b)
  const deduped: number[] = []
  let last = Number.NEGATIVE_INFINITY
  for (const radius of sorted) {
    if (radius - last < epsilon) continue
    deduped.push(radius)
    last = radius
  }
  return deduped.slice(0, maxCount)
}
