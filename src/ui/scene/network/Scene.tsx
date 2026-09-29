import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { NetworkModel } from '../../../domain/network'
import { mycelium } from '../../theme/tokens'
import { NetworkSceneContent } from './NetworkSceneContent'

export interface NetworkSceneProps {
  model: NetworkModel
  getCurrentTime: () => number
  reducedMotion: boolean
  onElementHover?: (id: string | null) => void
  onElementSelect?: (id: string | null) => void
  hoveredId?: string | null
  selectedId?: string | null
  /** Hands the underlying `<canvas>` element up once the renderer mounts (P10 "save image"). */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
}

/**
 * The lazy-loaded 3D chunk for the mycelium network (M3), replacing the
 * tree's `scene/Scene.tsx` as what `ViewerPage` renders -- the tree scene is
 * left in place, unrouted, until M4 removes it.
 *
 * Glow (P2) is SELECTIVE via a luminance-threshold `Bloom`: hyphae/hairs
 * render at ordinary brightness (below the threshold, so they stay crisp,
 * not hazy) while emissive things -- tips, fusion knots, mushroom rims, the
 * spore, and a selected/hovered hypha's additive highlight boost -- cross
 * the threshold and glow. `EffectComposer` forces the renderer's own tone
 * mapping off, so tone mapping is applied as its own effect instead
 * (`NEUTRAL`, not `ACES_FILMIC` -- the tree's V2 pass found ACES's shadow
 * toe crushes a wide range of dim values into the same too-dark output, see
 * `odd/tasks/huerto-mvp.md`).
 */
export default function Scene({
  model,
  getCurrentTime,
  reducedMotion,
  onElementHover,
  onElementSelect,
  hoveredId = null,
  selectedId = null,
  onCanvasReady,
}: NetworkSceneProps) {
  // A FLAT background (not the tree scene's vertical sky gradient, see
  // `skyTexture.ts` -- deliberately not reused here) matching the soil
  // shader's own vignette target (`soilMaterial.ts`'s `uEdgeColor`) exactly.
  // A round-2 M3b visual finding: even a subtle two-stop gradient produced a
  // visible edge-contrast "rim" around the disc's circular silhouette
  // wherever the background happened to be locally lighter than the disc's
  // own darkest edge tone -- an identical flat color behind AND at the
  // disc's own rim removes that mismatch everywhere around the circle, not
  // just approximately.
  const background = useMemo(() => new THREE.Color(mycelium.soilNear), [])

  return (
    <Canvas
      camera={{ fov: 42, near: 0.05, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ cursor: hoveredId ? 'pointer' : 'auto' }}
      onCreated={({ gl, scene }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        scene.background = background
        onCanvasReady?.(gl.domElement)
      }}
    >
      <NetworkSceneContent
        model={model}
        getCurrentTime={getCurrentTime}
        reducedMotion={reducedMotion}
        onElementHover={onElementHover}
        onElementSelect={onElementSelect}
        hoveredId={hoveredId}
        selectedId={selectedId}
      />
      <EffectComposer multisampling={0}>
        {/* Raised threshold + lower intensity than a first pass (M3 round-1
            visual QA finding): a dense colony's many overlapping additive
            strands could still cumulatively cross a lower threshold across
            wide areas, blooming into an undifferentiated haze instead of
            picking out only genuinely emissive things (tips, fusion knots,
            mushroom rims, the spore, a selected/hovered highlight boost). */}
        {/* M3c item 2: threshold/intensity nudged (0.88/0.5 -> 0.84/0.62) for
            a bit more bloom on the densest arms and the spore halo, still
            comfortably above where a round-1 M3 finding saw a dense colony's
            overlapping strands bloom into an undifferentiated haze. */}
        <Bloom luminanceThreshold={0.84} luminanceSmoothing={0.15} intensity={0.62} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
