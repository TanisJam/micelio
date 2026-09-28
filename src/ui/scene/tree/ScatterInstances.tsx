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
  /** Small off-vertical tilt (radians), for canopy volume. Defaults to 0. */
  tiltX?: number
  tiltZ?: number
}

export interface ScatterInstancesProps {
  geometry: THREE.BufferGeometry
  items: ScatterItem[]
  bounds: TimeBounds
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

const HOVER_TINT_AMOUNT = 0.3
const SELECT_TINT_AMOUNT = 0.55

/**
 * One instanced mesh (single draw call) for a scattered set of small
 * elements -- leaves, fruit, flowers or buds. Each instance pops in
 * (ease-out scale from 0) at its own `time`, and carries its own color via
 * per-instance vertex color (e.g. the leaf age ramp), so a single shared
 * material still reads as varied. The hovered/selected instance (if any) is
 * tinted toward white on top of its base color (P7).
 */
export function ScatterInstances({
  geometry,
  items,
  bounds,
  getCurrentTime,
  onHover,
  onSelect,
  hoveredId,
  selectedId,
}: ScatterInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const count = items.length

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

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const currentTime = getCurrentTime()
    const colorAttr = mesh.instanceColor

    for (let i = 0; i < count; i++) {
      const item = items[i]!
      const grow = popScale(item.time, bounds, currentTime)
      if (grow <= 0) {
        matrix.copy(scatteredInstanceMatrix(HIDDEN_POSITION, 0, 0.0001))
      } else {
        matrix.copy(
          scatteredInstanceMatrix(item.position, item.rotation, item.scale * grow, item.tiltX ?? 0, item.tiltZ ?? 0),
        )
      }
      mesh.setMatrixAt(i, matrix)

      if (colorAttr) {
        const isSelected = item.id === selectedId
        const isHovered = !isSelected && item.id === hoveredId
        const amount = isSelected ? SELECT_TINT_AMOUNT : isHovered ? HOVER_TINT_AMOUNT : 0
        const baseIndex = i * 3
        const baseR = colorArray[baseIndex]!
        const baseG = colorArray[baseIndex + 1]!
        const baseB = colorArray[baseIndex + 2]!
        colorAttr.setXYZ(i, baseR + (1 - baseR) * amount, baseG + (1 - baseG) * amount, baseB + (1 - baseB) * amount)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (colorAttr) colorAttr.needsUpdate = true
  })

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
