import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

export interface CameraRigProps {
  /** The colony disc's bounding radius (`NetworkModel.bounds.radius`). */
  radius: number
}

// Breathing room beyond a tight bounding-circle fit, and framing at a 3/4
// top-down angle. Lowered from 55deg (M3's original pitch, orbiting closer
// to fully overhead) to 45deg per the M3b visual review: mushroom caps need
// enough angle-to-horizontal for their own silhouette/underside-rim shading
// to actually be visible against the soil, which a near-overhead camera
// hides almost entirely.
const FRAME_MARGIN = 1.28
const PITCH_RADIANS = (45 * Math.PI) / 180

/**
 * The camera distance that frames a disc of `radius` fully within both the
 * vertical AND horizontal FOV (whichever is tighter) -- a narrow portrait
 * viewport (aspect < 1) makes the HORIZONTAL fov the binding constraint,
 * which needs a much larger distance than a landscape viewport's vertical
 * fov does. Pure (no React/three.js side effects) so it can be reused both
 * for the initial camera position and for `OrbitControls`' own
 * `maxDistance` (see the M3c round-4 orchestrator finding below).
 */
function computeFramingDistance(radius: number, verticalFovRadians: number, aspect: number): number {
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * aspect)
  const limitingFov = Math.min(verticalFovRadians, horizontalFov)
  return (radius / Math.sin(limitingFov / 2)) * FRAME_MARGIN
}

/**
 * Positions the perspective camera to frame the whole colony disc on load
 * (accounting for both vertical and horizontal FOV, so a narrow mobile
 * viewport doesn't crop the disc's width), and sets up damped
 * `OrbitControls` with polar/distance limits so the viewer can never orbit
 * below the soil or clip through the spore.
 */
export function CameraRig({ radius }: CameraRigProps) {
  const { camera, size } = useThree()
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const target: [number, number, number] = [0, 0, 0]

  const verticalFov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
  const aspect = size.height > 0 ? size.width / size.height : 1
  const framingDistance = computeFramingDistance(radius, verticalFov, aspect)
  // M3c round-4 orchestrator finding: a static `maxDistance` (previously
  // `radius * 4.5`) clamps the camera BACK toward the disc right after the
  // effect below sets it -- `OrbitControls.update()` enforces its own
  // min/maxDistance on every call, including the one this effect makes right
  // after positioning the camera. For a landscape viewport `framingDistance`
  // (~3.6x radius at a 1440x900 desktop) stayed comfortably under the old
  // 4.5x cap, so the bug never showed there -- but a narrow portrait phone
  // (~7.3x radius at 390x844) needs FAR more distance to fit the disc's
  // width, got silently clamped back down to 4.5x, and cropped the disc's
  // left/right edges. `maxDistance` must scale with the same framing
  // distance this component actually uses, with real headroom (not just
  // barely enough) so the user can still orbit/zoom out a bit further.
  const maxDistance = Math.max(radius * 4.5, framingDistance * 1.6)

  useEffect(() => {
    camera.position.set(0, framingDistance * Math.sin(PITCH_RADIANS), framingDistance * Math.cos(PITCH_RADIANS))
    camera.lookAt(0, 0, 0)
    controlsRef.current?.target.set(0, 0, 0)
    controlsRef.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, size.width, size.height])

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(radius * 0.5, 1)}
      maxDistance={maxDistance}
      // Never dip below the soil (a small positive floor), and never go
      // fully overhead either -- keeps the 3/4 read intact while orbiting.
      minPolarAngle={0.35}
      maxPolarAngle={1.45}
      target={target}
      makeDefault
    />
  )
}
