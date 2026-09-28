import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { limbGrowthProgress } from '../../../domain/tree'
import type { TreeModel } from '../../../domain/tree'
import { drawRangeForProgress } from '../geometry/tubeGeometry'
import type { LimbGeometryEntry } from './useTreeGeometry'

export interface LimbMeshesProps {
  model: TreeModel
  limbs: LimbGeometryEntry[]
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}

/** One mesh per limb (there are at most ~16), each individually revealed via draw range as its era's PRs land. */
export function LimbMeshes({ model, limbs, getCurrentTime, onHover, onSelect }: LimbMeshesProps) {
  return (
    <>
      {limbs.map((limb) => (
        <LimbMesh key={limb.id} model={model} limb={limb} getCurrentTime={getCurrentTime} onHover={onHover} onSelect={onSelect} />
      ))}
    </>
  )
}

function LimbMesh({
  model,
  limb,
  getCurrentTime,
  onHover,
  onSelect,
}: {
  model: TreeModel
  limb: LimbGeometryEntry
  getCurrentTime: () => number
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}) {
  const lastProgress = useRef(-1)
  const modelLimb = model.limbs.find((l) => l.id === limb.id)!
  const twigs = model.twigs

  useFrame(() => {
    const progress = limbGrowthProgress(modelLimb, twigs, model.bounds, getCurrentTime())
    if (progress === lastProgress.current) return
    lastProgress.current = progress
    const count = drawRangeForProgress(limb.tube, progress)
    limb.geometry.setDrawRange(0, count)
  })

  return (
    <mesh
      geometry={limb.geometry}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover?.(limb.id)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(limb.id)
      }}
    >
      <meshStandardMaterial color={limb.color} roughness={0.85} metalness={0} flatShading />
    </mesh>
  )
}
