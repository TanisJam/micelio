import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { ModelBounds } from '../../../domain/tree'

export interface CameraRigProps {
  bounds: ModelBounds
}

/**
 * Positions the perspective camera to auto-frame the whole tree on load, and
 * sets up damped OrbitControls with distance/polar limits so the viewer
 * can't clip through the ground or zoom inside the trunk (P4).
 */
export function CameraRig({ bounds }: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const target: [number, number, number] = [bounds.center.x, bounds.maxHeight * 0.35, bounds.center.z]

  useEffect(() => {
    const fov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
    const distance = (bounds.radius / Math.sin(fov / 2)) * 1.05
    camera.position.set(target[0] + distance * 0.55, target[1] + distance * 0.45, target[2] + distance * 0.7)
    camera.lookAt(target[0], target[1], target[2])
    controlsRef.current?.target.set(target[0], target[1], target[2])
    controlsRef.current?.update()
    // Re-frame only when the tree itself changes (bounds), not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

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
