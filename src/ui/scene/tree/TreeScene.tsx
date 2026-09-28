import type { TreeModel } from '../../../domain/tree'
import { Buds } from './Buds'
import { CameraFocus } from './CameraFocus'
import { CameraRig } from './CameraRig'
import { Flowers } from './Flowers'
import { Fruits } from './Fruits'
import { Leaves } from './Leaves'
import { Lighting } from './Lighting'
import { LimbMeshes } from './LimbMeshes'
import { SoilIsland } from './SoilIsland'
import { TrunkMesh } from './TrunkMesh'
import { Twigs } from './Twigs'
import { useTreeGeometry } from './useTreeGeometry'
import { WindSway } from './WindSway'

export interface TreeSceneProps {
  model: TreeModel
  /** Reads the current growth-replay time (epoch ms) once per frame; not a React prop that re-renders the tree. */
  getCurrentTime: () => number
  reducedMotion: boolean
  onElementHover?: (id: string | null) => void
  onElementSelect?: (id: string) => void
  hoveredId?: string | null
  selectedId?: string | null
}

/**
 * The full low-poly tree diorama: soil island, trunk, limbs, twigs, leaves,
 * fruit, flowers, buds, lighting, sky and camera. Every rendered element
 * keeps a mapping back to its `TreeModel` element id via `onElementHover` /
 * `onElementSelect`, and is visually tinted/thickened when it matches
 * `hoveredId`/`selectedId` (P7). `CameraFocus` eases the camera to the
 * selection.
 */
export function TreeScene({
  model,
  getCurrentTime,
  reducedMotion,
  onElementHover,
  onElementSelect,
  hoveredId = null,
  selectedId = null,
}: TreeSceneProps) {
  const geometry = useTreeGeometry(model)

  return (
    <>
      <Lighting bounds={geometry.bounds} />
      <CameraRig bounds={geometry.bounds} />
      <CameraFocus model={model} selectedId={selectedId} reducedMotion={reducedMotion} />

      <SoilIsland geometry={geometry.island} />
      <TrunkMesh
        model={model}
        geometry={geometry.trunk}
        getCurrentTime={getCurrentTime}
        onHover={onElementHover}
        onSelect={onElementSelect}
        hoveredId={hoveredId}
        selectedId={selectedId}
      />

      <WindSway enabled={!reducedMotion}>
        <LimbMeshes
          model={model}
          limbs={geometry.limbs}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
        <Twigs
          model={model}
          geometry={geometry.twigGeometry}
          twigs={geometry.twigs}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
        <Leaves
          model={model}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
        <Fruits
          model={model}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
        <Flowers
          model={model}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
        <Buds
          model={model}
          getCurrentTime={getCurrentTime}
          onHover={onElementHover}
          onSelect={onElementSelect}
          hoveredId={hoveredId}
          selectedId={selectedId}
        />
      </WindSway>
    </>
  )
}
