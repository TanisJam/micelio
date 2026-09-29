import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { chooseCameraFraming, computeFramingDistance } from './cameraFraming'

export interface CameraRigProps {
  /** The colony disc's bounding radius (`NetworkModel.bounds.radius`). */
  radius: number
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
  // D2/T8: a narrow/portrait viewport gets a steeper pitch and a tighter
  // frame margin -- see `cameraFraming.ts`'s doc comment for why the fixed
  // desktop-tuned 45deg pitch left large empty bands above/below on mobile.
  const { pitchRadians, frameMargin } = chooseCameraFraming(aspect)
  const framingDistance = computeFramingDistance(radius, verticalFov, aspect, frameMargin)
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
    camera.position.set(0, framingDistance * Math.sin(pitchRadians), framingDistance * Math.cos(pitchRadians))
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
