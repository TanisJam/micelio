/**
 * Pure (no React/three.js) camera-framing math for `CameraRig.tsx`, split
 * out for direct unit testing.
 */
import { discRadius, pointOnHyphaAtTime, type NetworkModel } from '../../../domain/network'
import { addVec3, scaleVec3 } from '../../../domain/shared/vector'

// Breathing room beyond a tight bounding-circle fit for a landscape/desktop
// viewport, and framing at a 3/4 top-down angle. Lowered from 55deg (M3's
// original pitch, orbiting closer to fully overhead) to 45deg per the M3b
// visual review: mushroom caps need enough angle-to-horizontal for their own
// silhouette/underside-rim shading to actually be visible against the soil,
// which a near-overhead camera hides almost entirely.
// Post-final-pass (framing): lowered from 1.28. The colony used to be framed
// against `substrateRadiusFor(model)` (the substrate haze's own PADDED
// radius, `model.bounds.radius * DENSITY_FIELD_MARGIN` = 1.6x too big) --
// the colony's real, rendered extent only ever filled roughly its own
// radius's share of that inflated frame (~40% of the viewport's limiting
// dimension on a real `pmndrs/valtio` screenshot). Framing against the
// model's own TRUE bounding radius instead (see `CameraRig.tsx`) already
// closes most of that gap; this margin is retuned on top of that fix to
// land close to the target ~85% fill.
export const LANDSCAPE_FRAME_MARGIN = 0.92
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
// Post-final-pass (framing): retuned from 1.1 alongside the landscape
// margin above, for the same ~85%-fill target now that framing uses the
// model's true bounding radius rather than the padded substrate radius.
export const PORTRAIT_FRAME_MARGIN = 0.85
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

/**
 * Post-final-pass (framing): the colony's own tightest bounding radius AT
 * `time` -- not the model's FINAL (fully-grown) `bounds.radius`, which is
 * what `CameraRig` used to frame against for the WHOLE replay, including
 * its very first frames when only a couple of hyphae exist near the spore.
 * That meant the camera sat at its final, zoomed-out distance from the
 * start, making early growth read as a tiny, distant cluster rather than
 * something the camera eases out FROM. `CameraRig` uses this every frame
 * (while replay is actively playing and the viewer hasn't taken over) to
 * smoothly ease the framing distance outward as the colony actually grows.
 *
 * Mirrors `buildNetwork.ts`'s own final-`bounds.radius` computation (same
 * contributing sources: hypha points, hair tips, mushrooms) but each
 * evaluated AT `time` instead of at its own final state:
 * `pointOnHyphaAtTime` already clamps to a hypha's own `[first, last]` time
 * range, so an unsplit hypha simply contributes its still-unmoved split
 * point; a hair/mushroom not yet born (`time` before its own `time` field)
 * is excluded entirely rather than counted early.
 */
/**
 * Round-3 orchestrator finding (task B): easing the framing distance toward
 * `computeGrownRadius`'s literal value made early replay (a couple of
 * hyphae near the spore) zoom in FAR too aggressively -- close enough that
 * the spore's halo filled the frame as a giant disc and the traveling
 * growth-front point read as a huge circle. `CameraRig` runs the eased
 * grown radius through this floor every frame: never closer than framing
 * roughly `REPLAY_MIN_GROWN_RADIUS_FRACTION` of the colony's OWN final
 * extent (`finalRadius`, `model.bounds.radius`), plus a small absolute floor
 * for a near-degenerate colony whose final radius itself is tiny.
 */
export const REPLAY_MIN_GROWN_RADIUS_FRACTION = 0.4
export const REPLAY_MIN_GROWN_RADIUS_FLOOR = 0.5

export function clampReplayGrownRadius(grownRadius: number, finalRadius: number): number {
  return Math.max(grownRadius, finalRadius * REPLAY_MIN_GROWN_RADIUS_FRACTION, REPLAY_MIN_GROWN_RADIUS_FLOOR)
}

export function computeGrownRadius(model: NetworkModel, time: number): number {
  let maxRadius = 0
  for (const hypha of model.hyphae) {
    if (hypha.kind === 'main') continue
    const point = pointOnHyphaAtTime(hypha.points, time)
    if (!point) continue
    const radius = discRadius(point)
    if (radius > maxRadius) maxRadius = radius
  }
  for (const hair of model.hairs) {
    if (hair.time > time) continue
    const tip = addVec3(hair.position, scaleVec3(hair.direction, hair.length))
    const radius = discRadius(tip)
    if (radius > maxRadius) maxRadius = radius
  }
  for (const mushroom of model.mushrooms) {
    if (mushroom.time > time) continue
    const radius = discRadius(mushroom.position)
    if (radius > maxRadius) maxRadius = radius
  }
  return maxRadius
}
