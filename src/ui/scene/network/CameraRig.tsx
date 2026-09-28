import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

export interface CameraRigProps {
  /** The colony disc's bounding radius (`NetworkModel.bounds.radius`). */
  radius: number
}

// Breathing room beyond a tight bounding-circle fit, and framing at a 3/4
// top-down angle (P1's visual direction: ~50-60 deg from horizontal).
const FRAME_MARGIN = 1.28
const PITCH_RADIANS = (55 * Math.PI) / 180

/**
 * Positions the perspective camera to frame the whole colony disc on load
 * (accounting for both vertical and horizontal FOV, so a narrow mobile
 * viewport doesn't crop the disc's width -- mirrors the tree's own
 * `CameraRig`), and sets up damped `OrbitControls` with polar/distance
 * limits so the viewer can never orbit below the soil or clip through the
 * spore.
 */
export function CameraRig({ radius }: CameraRigProps) {
  const { camera, size } = useThree()
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const target: [number, number, number] = [0, 0, 0]

  useEffect(() => {
    const verticalFov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
    const aspect = size.height > 0 ? size.width / size.height : 1
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    const limitingFov = Math.min(verticalFov, horizontalFov)
    const distance = (radius / Math.sin(limitingFov / 2)) * FRAME_MARGIN

    camera.position.set(0, distance * Math.sin(PITCH_RADIANS), distance * Math.cos(PITCH_RADIANS))
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
      maxDistance={radius * 4.5}
      // Never dip below the soil (a small positive floor), and never go
      // fully overhead either -- keeps the 3/4 read intact while orbiting.
      minPolarAngle={0.35}
      maxPolarAngle={1.45}
      target={target}
      makeDefault
    />
  )
}
