import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { twigGrowthProgress } from '../../../domain/tree'
import type { TreeModel } from '../../../domain/tree'
import { palette } from '../../theme/tokens'
import { alignedInstanceMatrix } from '../geometry/instances'
import type { TwigInstanceData } from './useTreeGeometry'

export interface TwigsProps {
  model: TreeModel
  geometry: THREE.BufferGeometry
  twigs: TwigInstanceData
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

const HOVER_RADIUS_SCALE = 1.35
const SELECT_RADIUS_SCALE = 1.7

/** All twigs as one instanced mesh (a single draw call): each instance is a canonical straight tapered tube, aligned to its own base->tip direction and scaled along that axis to animate growth. The hovered/selected twig (if any) is rendered visibly thicker (P7). */
export function Twigs({ model, geometry, twigs, getCurrentTime, onHover, onSelect, hoveredId, selectedId }: TwigsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const count = twigs.data.length
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const currentTime = getCurrentTime()

    for (let i = 0; i < count; i++) {
      const twig = twigs.data[i]!
      const progress = twigGrowthProgress(twig, model.bounds, currentTime)
      const length = twigs.length[i]! * progress
      const id = twigs.ids[i]
      const radiusScale = id === selectedId ? SELECT_RADIUS_SCALE : id === hoveredId ? HOVER_RADIUS_SCALE : 1
      const radius = twigs.radius * radiusScale
      matrix.copy(
        alignedInstanceMatrix(
          { x: twigs.base[i]!.x, y: twigs.base[i]!.y, z: twigs.base[i]!.z },
          { x: twigs.direction[i]!.x, y: twigs.direction[i]!.y, z: twigs.direction[i]!.z },
          { x: radius, y: Math.max(length, 0.0001), z: radius },
        ),
      )
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
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
        if (e.instanceId !== undefined) onHover?.(twigs.ids[e.instanceId] ?? null)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.instanceId !== undefined) {
          const id = twigs.ids[e.instanceId]
          if (id) onSelect?.(id)
        }
      }}
    >
      <meshStandardMaterial color={palette.barkLight} roughness={0.8} metalness={0} flatShading />
    </instancedMesh>
  )
}
