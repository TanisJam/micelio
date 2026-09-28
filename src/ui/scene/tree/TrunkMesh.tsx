import { useRef } from 'react'
import * as THREE from 'three'
import { trunkGrowthProgress } from '../../../domain/tree'
import type { TreeModel } from '../../../domain/tree'
import { useFrame } from '@react-three/fiber'
import { drawRangeForProgress } from '../geometry/tubeGeometry'
import type { TreeGeometry } from './useTreeGeometry'

export interface TrunkMeshProps {
  model: TreeModel
  geometry: TreeGeometry['trunk']
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}

/** The trunk: a single tapered, flat-shaded tube, revealed progressively via draw range as the growth clock advances. */
export function TrunkMesh({ model, geometry, getCurrentTime, onHover, onSelect }: TrunkMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const lastProgress = useRef(-1)

  useFrame(() => {
    const progress = trunkGrowthProgress(model.trunk, getCurrentTime())
    if (progress === lastProgress.current) return
    lastProgress.current = progress
    const count = drawRangeForProgress(geometry.tube, progress)
    geometry.geometry.setDrawRange(0, count)
  })

  return (
    <mesh
      geometry={geometry.geometry}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover?.('trunk')
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.('trunk')
      }}
    >
      <meshStandardMaterial ref={materialRef} color={geometry.color} roughness={0.85} metalness={0} flatShading />
    </mesh>
  )
}
