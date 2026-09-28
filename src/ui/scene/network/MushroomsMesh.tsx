import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { applyGrowthToInstances } from './geometry/applyGrowth'
import { getMushroomGeometry } from './geometry/mushroomGeometry'

export interface MushroomsMeshProps {
  matrices: THREE.Matrix4[]
  birthTimes: number[]
  getCurrentTime: () => number
}

/**
 * Every release as one `InstancedMesh` draw call (P12), the shared
 * `LatheGeometry` cap+stem from `mushroomGeometry.ts` with its own baked
 * per-vertex color (cream cap, cyan rim). Growth reveal per instance, same
 * pattern as `PointGlowInstances`.
 */
export function MushroomsMesh({ matrices, birthTimes, getCurrentTime }: MushroomsMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = getMushroomGeometry()
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || matrices.length === 0) return
    applyGrowthToInstances(mesh, matrices, birthTimes, getCurrentTime())
  })

  if (matrices.length === 0) return null

  return <instancedMesh ref={meshRef} args={[geometry, material, matrices.length]} frustumCulled={false} />
}
