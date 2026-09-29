/**
 * Pure (no React/three.js) camera-framing math for `CameraRig.tsx`, split
 * out for direct unit testing.
 */

// Breathing room beyond a tight bounding-circle fit for a landscape/desktop
// viewport, and framing at a 3/4 top-down angle. Lowered from 55deg (M3's
// original pitch, orbiting closer to fully overhead) to 45deg per the M3b
// visual review: mushroom caps need enough angle-to-horizontal for their own
// silhouette/underside-rim shading to actually be visible against the soil,
// which a near-overhead camera hides almost entirely.
export const LANDSCAPE_FRAME_MARGIN = 1.28
export const LANDSCAPE_PITCH_RADIANS = (45 * Math.PI) / 180

/**
 * D2/T8: a portrait/narrow viewport (aspect < 1) read as a small disc with
 * large empty bands above/below even once it fit the width, at the SAME
 * 45deg "3/4" pitch tuned for a wide desktop viewport. A flat, near-ground-
 * level disc viewed from a LOWER pitch (further from straight-down) projects
 * as a more heavily foreshortened ellipse -- its on-screen VERTICAL extent
 * shrinks relative to its horizontal extent (which pitch doesn't affect at
 * all) as pitch drops toward the horizon. Steepening the pitch toward
 * top-down for portrait viewports grows the disc's vertical footprint for
 * the SAME width-constrained distance; a tighter frame margin (closer
 * distance) then fills more of that width too. 60deg keeps enough
 * angle-to-horizontal for mushroom-cap shading to still read (fully
 * top-down, 90deg, would flatten it away entirely, the exact M3b finding
 * that moved the desktop pitch down from 55deg to 45deg in the first
 * place).
 */
export const PORTRAIT_FRAME_MARGIN = 1.1
export const PORTRAIT_PITCH_RADIANS = (60 * Math.PI) / 180

export interface CameraFraming {
  pitchRadians: number
  frameMargin: number
}

/** Picks the pitch/frame-margin pair for a viewport's aspect ratio (width / height). */
export function chooseCameraFraming(aspect: number): CameraFraming {
  const isPortrait = aspect < 1
  return {
    pitchRadians: isPortrait ? PORTRAIT_PITCH_RADIANS : LANDSCAPE_PITCH_RADIANS,
    frameMargin: isPortrait ? PORTRAIT_FRAME_MARGIN : LANDSCAPE_FRAME_MARGIN,
  }
}

/**
 * The camera distance that frames a disc of `radius` fully within both the
 * vertical AND horizontal FOV (whichever is tighter) -- a narrow portrait
 * viewport (aspect < 1) makes the HORIZONTAL fov the binding constraint,
 * which needs a much larger distance than a landscape viewport's vertical
 * fov does.
 */
export function computeFramingDistance(radius: number, verticalFovRadians: number, aspect: number, frameMargin: number): number {
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * aspect)
  const limitingFov = Math.min(verticalFovRadians, horizontalFov)
  return (radius / Math.sin(limitingFov / 2)) * frameMargin
}
