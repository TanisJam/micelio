/**
 * Round-3 orchestrator finding (task B/C): a couple of small glow meshes
 * (the spore's halo, the traveling growth-front point) have a fixed WORLD-
 * space radius -- fine at the colony's normal framing distance, but at an
 * aggressively close camera (the replay-zoom bug this same round also
 * fixes, see `cameraFraming.ts`'s `clampReplayGrownRadius`) they projected
 * as a giant on-screen disc/circle. This is a second, independent guard:
 * regardless of how close the camera ever gets (replay easing, or the
 * viewer's own manual zoom), a glow's APPARENT on-screen radius is capped in
 * pixels by shrinking its rendered world-space radius as needed. Pure (no
 * React/three.js) so it's directly unit-testable.
 */

/**
 * The world-space radius that would project to exactly `maxPixelRadius`
 * pixels on screen for an object `distance` world units from a perspective
 * camera with the given vertical FOV and viewport height. `Infinity` for a
 * degenerate (non-positive) input, so a caller's `Math.min` with it is a
 * no-op rather than collapsing to 0.
 */
export function computeMaxWorldRadiusForPixels(
  distance: number,
  verticalFovRadians: number,
  viewportHeightPx: number,
  maxPixelRadius: number,
): number {
  if (!(distance > 0) || !(viewportHeightPx > 0) || !(verticalFovRadians > 0)) return Number.POSITIVE_INFINITY
  const pixelsPerWorldUnit = viewportHeightPx / (2 * distance * Math.tan(verticalFovRadians / 2))
  if (!(pixelsPerWorldUnit > 0)) return Number.POSITIVE_INFINITY
  return maxPixelRadius / pixelsPerWorldUnit
}

/** `desiredRadius`, shrunk if needed so it never projects wider than `maxPixelRadius` on screen at `distance`. Never grows it past `desiredRadius`. */
export function clampWorldRadiusForScreenSize(
  desiredRadius: number,
  distance: number,
  verticalFovRadians: number,
  viewportHeightPx: number,
  maxPixelRadius: number,
): number {
  const maxRadius = computeMaxWorldRadiusForPixels(distance, verticalFovRadians, viewportHeightPx, maxPixelRadius)
  return Math.min(desiredRadius, maxRadius)
}
