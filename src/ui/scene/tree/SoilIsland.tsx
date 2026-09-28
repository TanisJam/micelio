import type * as THREE from 'three'
import { ContactShadows } from '@react-three/drei'
import { ISLAND_DEPTH, ISLAND_TOP_RADIUS } from '../geometry/island'

export interface SoilIslandProps {
  geometry: THREE.BufferGeometry
}

/**
 * The floating soil island: a single vertex-colored, flat-shaded mesh (see
 * `buildIslandGeometry`), plus a soft blurred contact shadow hovering just
 * below its rocky underside -- reinforcing that the island floats in the
 * sky rather than sitting on solid ground (P2).
 */
export function SoilIsland({ geometry }: SoilIslandProps) {
  return (
    <>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
      </mesh>
      <ContactShadows
        position={[0, -ISLAND_DEPTH - 0.35, 0]}
        opacity={0.55}
        scale={ISLAND_TOP_RADIUS * 2.6}
        blur={2.4}
        far={ISLAND_DEPTH + 0.6}
        resolution={256}
        color="#2a1c10"
        frames={1}
      />
    </>
  )
}
