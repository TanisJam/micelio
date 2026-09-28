import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { ModelBounds } from '../../../domain/tree'

export interface CameraRigProps {
  bounds: ModelBounds
}

// Extra breathing room beyond the tight bounding-sphere fit, and a slight
// low 3/4 viewing angle (P3/P6): comfortable margins on every side, crown
// never touching the frame edge.
const FRAME_MARGIN = 1.22

/**
 * Positions the perspective camera to auto-frame the whole tree on load, and
 * sets up damped OrbitControls with distance/polar limits so the viewer
 * can't clip through the ground or zoom inside the trunk (P4).
 */
export function CameraRig({ bounds }: CameraRigProps) {
  const { camera, size } = useThree()
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const target: [number, number, number] = [bounds.center.x, bounds.maxHeight * 0.4, bounds.center.z]

  useEffect(() => {
    const verticalFov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
    const aspect = size.height > 0 ? size.width / size.height : 1
    // A narrow (portrait/mobile) viewport has a *smaller* effective
    // horizontal FOV than vertical -- framing only against the vertical FOV
    // would crop the crown's width on mobile. Compute both and back the
    // camera off enough to satisfy whichever is tighter.
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    const limitingFov = Math.min(verticalFov, horizontalFov)
    const distance = (bounds.radius / Math.sin(limitingFov / 2)) * FRAME_MARGIN
    // Slight low 3/4 angle: camera sits a bit below the crown's midpoint
    // relative to a pure 45 deg isometric look, so the canopy reads as mass
    // overhead rather than being viewed flat-on from above.
    camera.position.set(target[0] + distance * 0.58, target[1] + distance * 0.32, target[2] + distance * 0.74)
    camera.lookAt(target[0], target[1], target[2])
    controlsRef.current?.target.set(target[0], target[1], target[2])
    controlsRef.current?.update()
    // Re-frame when the tree or the viewport shape changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size.width, size.height])

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(bounds.radius * 0.6, 1.2)}
      maxDistance={bounds.radius * 4}
      minPolarAngle={0.15}
      maxPolarAngle={1.4}
      target={target}
      makeDefault
    />
  )
}
