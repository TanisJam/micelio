import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildPointInstances } from './geometry/pointInstances'
import { buildMushroomInstances } from './geometry/mushroomInstances'
import { buildFilamentsGeometry } from './geometry/filamentsGeometry'
import { buildHyphaeGeometry } from './geometry/hyphaeGeometry'
import { createGrowthMaterial, type GrowthMaterial } from './geometry/growthMaterial'
import { FUSION_FLASH_WINDOW_MS } from './geometry/applyGrowth'
import { buildPickGrid, queryNearest, type PickTarget } from './picking/pickingGrid'
import { CameraFocus } from './CameraFocus'
import { CameraRig } from './CameraRig'
import { GrowthFrontInstances } from './GrowthFrontInstances'
import { MushroomsMesh } from './MushroomsMesh'
import { PointGlowInstances } from './PointGlowInstances'
import { SporeMesh } from './SporeMesh'
import type { NetworkModel } from '../../../domain/network'
import { mycelium } from '../../theme/tokens'

export interface NetworkSceneContentProps {
  model: NetworkModel
  /** Reads the current growth-replay time (epoch ms) once per frame; not a React prop that re-renders the scene. */
  getCurrentTime: () => number
  reducedMotion: boolean
  /** Unit 4: reads the growth clock's own play state once per frame -- forwarded to `CameraRig`'s gentle auto-orbit. */
  isReplayPlaying?: () => boolean
  onElementHover?: (id: string | null) => void
  onElementSelect?: (id: string | null) => void
  hoveredId?: string | null
  selectedId?: string | null
}

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const FUSION_RADIUS = 0.03
const TIP_RADIUS = 0.05
/** Soft additive glow behind each mushroom cap (P1's mushroom brief: "soft point glow") -- larger than the cap itself so it reads as an ambient halo, not a second solid shape. */
const MUSHROOM_GLOW_RADIUS = 0.16

/**
 * The full mycelium colony scene: spore, batched hyphae/hair geometry,
 * mushrooms and glowing fusion/tip points, camera, and picking. Round-3
 * orchestrator finding: the earlier density-texture substrate haze (a
 * rasterized field sampled into a low-res `DataTexture`) read as a blocky,
 * pixelated disc with hard-edged holes on real repos -- removed entirely.
 * The scene now sits on pure black; whatever ambient glow the colony has
 * comes only from `Scene.tsx`'s own wide/soft second `Bloom` pass scattering
 * real light off the hyphae themselves, never a separate mesh/texture.
 *
 * Picking (P7): the network is nearly flat, so the pointer is raycast onto
 * the y=0 ground plane (not against individual mesh triangles) and the
 * nearest element is found via a precomputed 2D spatial grid
 * (`pickingGrid.ts`) built once per model from every hypha segment/hair/
 * mushroom/tip -- O(local neighborhood), not a per-frame linear scan.
 */
export function NetworkSceneContent({
  model,
  getCurrentTime,
  reducedMotion,
  isReplayPlaying,
  onElementHover,
  onElementSelect,
  hoveredId = null,
  selectedId = null,
}: NetworkSceneContentProps) {
  const { gl, camera } = useThree()

  const hyphae = useMemo(() => buildHyphaeGeometry(model), [model])
  const filaments = useMemo(() => buildFilamentsGeometry(model, hyphae.hyphaIndexById), [model, hyphae])
  const mushroomInstances = useMemo(() => buildMushroomInstances(model.mushrooms), [model])
  const mushroomGlowInstances = useMemo(
    () =>
      buildPointInstances(
        model.mushrooms.map((mushroom) => ({ id: mushroom.id, time: mushroom.time, position: mushroom.position })),
        MUSHROOM_GLOW_RADIUS,
      ),
    [model],
  )
  const tipInstances = useMemo(
    () => buildPointInstances(model.tips.map((tip) => ({ id: tip.id, time: tip.time, position: tip.position })), TIP_RADIUS),
    [model],
  )
  const fusionInstances = useMemo(
    () =>
      buildPointInstances(
        model.fusions.map((fusion) => ({ id: fusion.id, time: fusion.time, position: fusion.position })),
        FUSION_RADIUS,
      ),
    [model],
  )

  // One material instance for the component's whole lifetime (its uniforms
  // fully describe all per-model growth/highlight/flow state each frame, so
  // it never needs recreating when `model` changes, only disposing on
  // unmount). Its per-frame uniform mutation below reads it back out through
  // `hyphaeMeshRef.current.material` (a ref access inside `useFrame`, not
  // during render) rather than closing over this `useMemo` value directly --
  // mutating a value that's *also* handed straight to JSX as a prop trips
  // `react-hooks/immutability` (mirrors the tree's `ScatterInstances`, which
  // always mutates through `meshRef.current`, never a bare `useMemo` value).
  const filamentMaterial = useMemo(() => createGrowthMaterial(), [])
  const hyphaeMeshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    return () => {
      filamentMaterial.dispose()
    }
  }, [filamentMaterial])

  useEffect(() => {
    return () => {
      hyphae.geometry.dispose()
      filaments.geometry.dispose()
    }
  }, [hyphae, filaments])

  const pickGrid = useMemo(() => {
    const sporeTarget: PickTarget = {
      id: model.spore.id,
      x1: model.spore.position.x,
      z1: model.spore.position.z,
      x2: model.spore.position.x,
      z2: model.spore.position.z,
      visibleAt: model.spore.time,
    }
    const targets = [
      sporeTarget,
      ...hyphae.pickTargets,
      ...filaments.pickTargets,
      ...mushroomInstances.pickTargets,
      ...tipInstances.pickTargets,
    ]
    const cellSize = Math.max(0.05, model.bounds.radius / 30)
    return buildPickGrid(targets, cellSize)
  }, [hyphae, filaments, mushroomInstances, tipInstances, model.bounds.radius, model.spore])

  const pickTolerance = Math.max(0.06, model.bounds.radius * 0.016)

  /** A hypha id maps to itself; a node/tip id maps to the hypha index it belongs to, so selecting/hovering a commit or a growing tip highlights its whole hypha too (P7: "Selection highlights the whole hypha"). */
  const elementIdToHyphaIndex = useMemo(() => {
    const map = new Map<string, number>()
    for (const [id, index] of hyphae.hyphaIndexById) map.set(id, index)
    for (const node of model.nodes) {
      const index = hyphae.hyphaIndexById.get(node.hyphaId)
      if (index !== undefined) map.set(node.id, index)
    }
    for (const tip of model.tips) {
      const index = hyphae.hyphaIndexById.get(tip.hyphaId)
      if (index !== undefined) map.set(tip.id, index)
    }
    return map
  }, [hyphae, model.nodes, model.tips])

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointerNdc = useRef(new THREE.Vector2())
  const intersection = useRef(new THREE.Vector3())

  function pickAt(clientX: number, clientY: number): { id: string; distance: number } | null {
    const rect = gl.domElement.getBoundingClientRect()
    pointerNdc.current.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointerNdc.current, camera)
    const hit = raycaster.ray.intersectPlane(GROUND_PLANE, intersection.current)
    if (!hit) return null
    // A2/T8: never resolve to an element that hasn't grown in yet -- gate by
    // the SAME `getCurrentTime()` the growth shader itself reads this frame.
    return queryNearest(pickGrid, intersection.current.x, intersection.current.z, pickTolerance, getCurrentTime())
  }

  useEffect(() => {
    const canvas = gl.domElement

    function handlePointerMove(event: PointerEvent) {
      const result = pickAt(event.clientX, event.clientY)
      onElementHover?.(result?.id ?? null)
    }
    function handlePointerLeave() {
      onElementHover?.(null)
    }
    function handleClick(event: MouseEvent) {
      const result = pickAt(event.clientX, event.clientY)
      onElementSelect?.(result?.id ?? null)
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('click', handleClick)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('click', handleClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, pickGrid, pickTolerance])

  useFrame((state) => {
    const material = hyphaeMeshRef.current?.material as GrowthMaterial | undefined
    if (!material) return
    const currentTime = getCurrentTime()
    const selectedIndex = selectedId !== null ? (elementIdToHyphaIndex.get(selectedId) ?? -1) : -1
    const hoveredIndex = hoveredId !== null ? (elementIdToHyphaIndex.get(hoveredId) ?? -1) : -1
    const uniforms = material.uniforms
    uniforms.uCurrentTime.value = currentTime
    uniforms.uSelectedIndex.value = selectedIndex
    uniforms.uHoveredIndex.value = hoveredIndex
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uFlowEnabled.value = reducedMotion ? 0 : 1
  })

  return (
    <>
      <CameraRig model={model} getCurrentTime={getCurrentTime} isReplayPlaying={isReplayPlaying} reducedMotion={reducedMotion} />
      <CameraFocus model={model} selectedId={selectedId} reducedMotion={reducedMotion} />

      <SporeMesh reducedMotion={reducedMotion} highlighted={hoveredId === model.spore.id || selectedId === model.spore.id} />

      <mesh ref={hyphaeMeshRef} geometry={hyphae.geometry} material={filamentMaterial} />
      <lineSegments geometry={filaments.geometry} material={filamentMaterial} />
      <GrowthFrontInstances hyphae={model.hyphae} getCurrentTime={getCurrentTime} reducedMotion={reducedMotion} />

      {/* Mushroom-only lighting (see `MushroomsMesh`'s doc): every other
          material in the scene is unlit, so these lights have no visible
          effect on anything but the mushrooms' `MeshStandardMaterial`. A
          strong key light + a deliberately DIM ambient fill (round-2 visual
          finding: a hemisphere light close in intensity to the key light
          washed the tiny cap back out into flat gray -- real light/shadow
          contrast is what makes a form this small still read as 3D) plus a
          low warm rim light from the opposite side for a lit edge against
          the dark substrate below. */}
      <directionalLight position={[1.6, 3.2, 2.4]} intensity={3.2} color={mycelium.mushroomCap} />
      <directionalLight position={[-2, 0.6, -1.4]} intensity={0.6} color={mycelium.mushroomRim} />
      {/* Ground bounce tint stays matched to the scene's own flat background
          (`mycelium.substrateFar`, also `Scene.tsx`'s `scene.background`) --
          there's no separate substrate mesh to pick a color from anymore. */}
      <hemisphereLight args={[mycelium.mushroomRim, mycelium.substrateFar, 0.16]} />

      <MushroomsMesh
        matrices={mushroomInstances.matrices}
        birthTimes={mushroomInstances.birthTimes}
        ids={mushroomInstances.ids}
        getCurrentTime={getCurrentTime}
        hoveredId={hoveredId}
        selectedId={selectedId}
      />
      <PointGlowInstances
        matrices={mushroomGlowInstances.matrices}
        birthTimes={mushroomGlowInstances.birthTimes}
        color={mycelium.mushroomRim}
        radius={MUSHROOM_GLOW_RADIUS}
        getCurrentTime={getCurrentTime}
        opacity={0.3}
      />
      <PointGlowInstances
        matrices={fusionInstances.matrices}
        birthTimes={fusionInstances.birthTimes}
        color={mycelium.fusion}
        radius={FUSION_RADIUS}
        getCurrentTime={getCurrentTime}
        flashWindowMs={FUSION_FLASH_WINDOW_MS}
      />
      <PointGlowInstances
        matrices={tipInstances.matrices}
        birthTimes={tipInstances.birthTimes}
        color={mycelium.hyphaOpen}
        radius={TIP_RADIUS}
        getCurrentTime={getCurrentTime}
        breathe
        reducedMotion={reducedMotion}
        ids={tipInstances.ids}
        hoveredId={hoveredId}
        selectedId={selectedId}
      />
    </>
  )
}
