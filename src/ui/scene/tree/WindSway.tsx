import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'

export interface WindSwayProps {
  enabled: boolean
  amplitude?: number
  speed?: number
  children: ReactNode
}

/** Wraps its children in a group that gently sways, disabled under `prefers-reduced-motion` (P4). */
export function WindSway({ enabled, amplitude = 0.015, speed = 0.6, children }: WindSwayProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const group = groupRef.current
    if (!group) return
    if (!enabled) {
      if (group.rotation.z !== 0 || group.rotation.x !== 0) {
        group.rotation.z = 0
        group.rotation.x = 0
      }
      return
    }
    const t = clock.getElapsedTime() * speed
    group.rotation.z = Math.sin(t) * amplitude
    group.rotation.x = Math.cos(t * 0.7) * amplitude * 0.6
  })

  return <group ref={groupRef}>{children}</group>
}
