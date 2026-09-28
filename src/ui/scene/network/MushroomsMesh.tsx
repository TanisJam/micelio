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
 *
 * Unlike every other element in the scene (flat `MeshBasicMaterial`/custom
 * additive shaders, deliberately immune to scene lighting), mushrooms use a
 * real lit material (`MeshStandardMaterial`) so their cap/stem actually
 * catch `NetworkSceneContent`'s two mushroom-only lights and read as small
 * 3D forms with a silhouette, not flat colored dots (round-2 M3b visual
 * finding: flat `MeshBasicMaterial` + no scene lights meant a mushroom's
 * cap had zero shading regardless of camera angle). Every OTHER material in
 * the scene stays fully unlit, so these two added lights have no visible
 * effect anywhere else.
 */
export function MushroomsMesh({ matrices, birthTimes, getCurrentTime }: MushroomsMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = getMushroomGeometry()
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }),
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
