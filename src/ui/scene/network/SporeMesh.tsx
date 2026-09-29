import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mycelium } from '../../theme/tokens'

export interface SporeMeshProps {
  reducedMotion: boolean
}

const CORE_RADIUS = 0.05
const HALO_RADIUS = 0.15

/**
 * The spore (first commit / repo root, P9's legend entry): a small bright
 * core with a soft halo. Deliberately modest brightness/size (P1: "the dense
 * center must not blow out into a white sun -- limit its bloom") -- the core
 * color is a near-white mint rather than pure white, and the halo is a large,
 * low-opacity additive sphere rather than a second hard-edged bright one.
 * Gentle idle "breathing" glow (P4), disabled under `prefers-reduced-motion`.
 */
export function SporeMesh({ reducedMotion }: SporeMeshProps) {
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (reducedMotion || !haloRef.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.06
    haloRef.current.scale.setScalar(pulse)
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[CORE_RADIUS, 16, 16]} />
        <meshBasicMaterial color={mycelium.sporeCore} toneMapped={false} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[HALO_RADIUS, 16, 16]} />
        {/* M3c item 2: a touch more bloom on the spore halo (0.16 -> 0.22) to
            help restore the brighter, more luminous read from before M3b's
            palette/brightness pass, while staying well short of "blown out". */}
        <meshBasicMaterial color={mycelium.sporeHalo} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
