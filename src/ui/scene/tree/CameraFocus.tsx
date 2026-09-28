import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easeInOutCubic } from '../../../domain/math'
import { getElementFocusPosition, type TreeModel } from '../../../domain/tree'

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

export interface CameraFocusProps {
  model: TreeModel
  selectedId: string | null
  reducedMotion: boolean
}

const FOCUS_DURATION_SECONDS = 0.9

interface FocusAnimation {
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  elapsed: number
}

/**
 * Eases the camera (and its OrbitControls target) toward the selected
 * element, keeping the camera's current distance/offset from its target so
 * the fly-to reads as "re-center on this", not a jarring zoom. Snaps
 * instantly under `prefers-reduced-motion` (P4/P7).
 */
export function CameraFocus({ model, selectedId, reducedMotion }: CameraFocusProps) {
  const { camera, controls } = useThree()
  const animationRef = useRef<FocusAnimation | null>(null)

  useEffect(() => {
    const orbitControls = controls as OrbitControlsImpl | null
    if (!selectedId || !orbitControls) return
    const focusPosition = getElementFocusPosition(model, selectedId)
    if (!focusPosition) return

    const toTarget = new THREE.Vector3(focusPosition.x, focusPosition.y, focusPosition.z)
    const fromTarget = orbitControls.target.clone()
    const offset = camera.position.clone().sub(fromTarget)
    const toPosition = toTarget.clone().add(offset)

    if (reducedMotion) {
      orbitControls.target.copy(toTarget)
      camera.position.copy(toPosition)
      orbitControls.update()
      animationRef.current = null
      return
    }

    animationRef.current = {
      fromTarget,
      toTarget,
      fromPosition: camera.position.clone(),
      toPosition,
      elapsed: 0,
    }
    // Re-run only when the selection itself changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useFrame((_state, delta) => {
    const orbitControls = controls as OrbitControlsImpl | null
    const animation = animationRef.current
    if (!animation || !orbitControls) return

    animation.elapsed += delta
    const t = easeInOutCubic(Math.min(1, animation.elapsed / FOCUS_DURATION_SECONDS))
    orbitControls.target.lerpVectors(animation.fromTarget, animation.toTarget, t)
    camera.position.lerpVectors(animation.fromPosition, animation.toPosition, t)
    orbitControls.update()

    if (t >= 1) animationRef.current = null
  })

  return null
}
