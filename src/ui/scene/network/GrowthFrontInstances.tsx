import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointOnHyphaAtTime, type Hypha } from '../../../domain/network'
import { mycelium } from '../../theme/tokens'
import { clampWorldRadiusForScreenSize } from './screenSizeClamp'

export interface GrowthFrontInstancesProps {
  hyphae: Hypha[]
  /** Reads the current growth-replay time (epoch ms) once per frame. */
  getCurrentTime: () => number
  reducedMotion: boolean
}

const FRONT_RADIUS = 0.045
/** Task B (round-3 orchestrator finding): "a growing tip is a huge cyan circle" at an aggressively close replay zoom -- caps the traveling growth-front point's own on-screen radius, same mechanism as `SporeMesh`'s halo. */
const FRONT_MAX_PIXEL_RADIUS = 26

/**
 * Unit 3/4: a bright glowing point that travels along each ACTIVELY
 * growing hypha's own polyline from its split to its end, in real (eased)
 * playback time -- the "growth front" the owner asked to be more
 * noticeable than the old instant per-vertex reveal alone. One instance per
 * hypha with a real time span; hidden (moved far away, scaled to 0) for a
 * hypha that hasn't started yet or has already finished growing (at which
 * point its fusion knot / static tip / dead color already carries the
 * "arrived" read, so this would only double up).
 */
export function GrowthFrontInstances({ hyphae, getCurrentTime, reducedMotion }: GrowthFrontInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(FRONT_RADIUS, 8, 8), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: mycelium.hyphaActiveTip, toneMapped: false, transparent: true, opacity: 0.95 }),
    [],
  )
  const growable = useMemo(() => hyphae.filter((h) => h.kind !== 'main' && h.points.length >= 2 && h.endTime > h.splitTime), [hyphae])
  // Reused every frame so the loop allocates nothing.
  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), scale: new THREE.Vector3() }), [])
  // True once every instance has been written hidden; lets idle frames (replay finished or not started)
  // skip the loop and the instance-buffer upload entirely until a hypha becomes active again.
  const allHiddenRef = useRef(false)

  useEffect(() => {
    allHiddenRef.current = false
  }, [growable])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh || growable.length === 0) return
    const currentTime = getCurrentTime()
    const anyActive = growable.some((h) => currentTime >= h.splitTime && currentTime < h.endTime)
    if (!anyActive && allHiddenRef.current) return

    const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * 3.5) * 0.18
    const { matrix, position: worldPosition, scale: worldScale } = scratch
    const camera = state.camera
    const verticalFov = 'fov' in camera ? THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) : Math.PI / 4

    for (let i = 0; i < growable.length; i++) {
      const hypha = growable[i]!
      const active = currentTime >= hypha.splitTime && currentTime < hypha.endTime
      const position = active ? pointOnHyphaAtTime(hypha.points, currentTime) : null

      if (!position) {
        matrix.makeTranslation(0, -1000, 0)
        matrix.scale(worldScale.set(0, 0, 0))
      } else {
        const distance = camera.position.distanceTo(worldPosition.set(position.x, position.y, position.z))
        const cappedRadius = clampWorldRadiusForScreenSize(FRONT_RADIUS * pulse, distance, verticalFov, state.size.height, FRONT_MAX_PIXEL_RADIUS)
        const scale = cappedRadius / FRONT_RADIUS
        matrix.makeTranslation(position.x, position.y, position.z)
        matrix.scale(worldScale.set(scale, scale, scale))
      }
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    allHiddenRef.current = !anyActive
  })

  if (growable.length === 0) return null

  return <instancedMesh ref={meshRef} args={[geometry, material, growable.length]} frustumCulled={false} />
}
