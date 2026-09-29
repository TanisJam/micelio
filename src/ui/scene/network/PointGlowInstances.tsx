import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { applyGrowthToInstances } from './geometry/applyGrowth'

export interface PointGlowInstancesProps {
  matrices: THREE.Matrix4[]
  birthTimes: number[]
  color: string
  radius: number
  /** Reads the current growth-replay time once per frame. */
  getCurrentTime: () => number
  /** Idle glow "breathing" (P4) -- a whole-mesh scale pulse, disabled under `prefers-reduced-motion`. */
  breathe?: boolean
  reducedMotion?: boolean
  /** Default 0.95 (a near-solid point, right for fusion knots/tips). A soft ambient halo (e.g. a mushroom's own glow, see `NetworkSceneContent`) wants a much lower value so it reads as a diffuse aura, not a second solid shape sitting on top of the lit cap. */
  opacity?: number
  /** Same order as `matrices`/`birthTimes` (see `buildPointInstances`) -- opt in to A3/T8's hover/select highlight for elements that ARE independently pickable (e.g. growing tips). Omitted for meshes with no matching pick targets (fusion knots, the mushroom glow halo, which piggybacks on `MushroomsMesh`'s own highlight instead). */
  ids?: string[]
  hoveredId?: string | null
  selectedId?: string | null
}

/**
 * Small glowing point elements sharing one draw call each (P12): fusion
 * knots (warm, tiny) and growing tips (bright, gently breathing). Growth
 * reveal (T5) is applied per instance every frame via `applyGrowthToInstances`
 * rather than rebuilding geometry.
 */
export function PointGlowInstances({
  matrices,
  birthTimes,
  color,
  radius,
  getCurrentTime,
  breathe = false,
  reducedMotion = false,
  opacity = 0.95,
  ids,
  hoveredId = null,
  selectedId = null,
}: PointGlowInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 10, 10), [radius])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity }),
    [color, opacity],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh || matrices.length === 0) return
    const targetId = selectedId ?? hoveredId
    const highlightIndex = targetId && ids ? ids.indexOf(targetId) : -1
    applyGrowthToInstances(mesh, matrices, birthTimes, getCurrentTime(), highlightIndex)
    if (breathe && !reducedMotion) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.15
      mesh.scale.setScalar(pulse)
    }
  })

  if (matrices.length === 0) return null

  return <instancedMesh ref={meshRef} args={[geometry, material, matrices.length]} frustumCulled={false} />
}
