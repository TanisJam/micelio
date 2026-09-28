import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { popScale, type TimeBounds, type Vec3 } from '../../../domain/tree'
import { scatteredInstanceMatrix } from '../geometry/instances'

// Not-yet-born instances get moved here in addition to zero-scaling: some
// software/renderer combinations rasterize a zero-scale (fully degenerate)
// instance as a stray single-pixel dot rather than nothing, so relying on
// scale alone to hide an ungrown element isn't reliable everywhere.
const HIDDEN_POSITION: Vec3 = { x: 0, y: -100000, z: 0 }

export interface ScatterItem {
  id: string
  position: Vec3
  rotation: number
  scale: number
  time: number
  color: string
}

export interface ScatterInstancesProps {
  geometry: THREE.BufferGeometry
  items: ScatterItem[]
  bounds: TimeBounds
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}

/**
 * One instanced mesh (single draw call) for a scattered set of small
 * elements -- leaves, fruit, flowers or buds. Each instance pops in
 * (ease-out scale from 0) at its own `time`, and carries its own color via
 * per-instance vertex color (e.g. the leaf age ramp), so a single shared
 * material still reads as varied.
 */
export function ScatterInstances({ geometry, items, bounds, getCurrentTime, onHover, onSelect }: ScatterInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const count = items.length

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const currentTime = getCurrentTime()

    for (let i = 0; i < count; i++) {
      const item = items[i]!
      const grow = popScale(item.time, bounds, currentTime)
      if (grow <= 0) {
        matrix.copy(scatteredInstanceMatrix(HIDDEN_POSITION, 0, 0.0001))
      } else {
        matrix.copy(scatteredInstanceMatrix(item.position, item.rotation, item.scale * grow))
      }
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  const colorArray = useMemo(() => {
    const array = new Float32Array(count * 3)
    const color = new THREE.Color()
    items.forEach((item, i) => {
      color.set(item.color)
      array[i * 3] = color.r
      array[i * 3 + 1] = color.g
      array[i * 3 + 2] = color.b
    })
    return array
  }, [items, count])

  if (count === 0) return null

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, undefined, count]}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        if (e.instanceId !== undefined) onHover?.(items[e.instanceId]?.id ?? null)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.instanceId !== undefined) {
          const id = items[e.instanceId]?.id
          if (id) onSelect?.(id)
        }
      }}
    >
      <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
      <meshStandardMaterial roughness={0.7} metalness={0} flatShading />
    </instancedMesh>
  )
}
