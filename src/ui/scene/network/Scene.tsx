import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { NetworkModel } from '../../../domain/network'
import { mycelium } from '../../theme/tokens'
import { silenceThreeClockDeprecationWarning } from '../../silenceThreeClockWarning'
import { NetworkSceneContent } from './NetworkSceneContent'

// B5/T8: called at MODULE scope (not inside the component, and deliberately
// not from the eager `main.tsx`) so it runs exactly once, before the first
// `<Canvas>` below ever mounts, but ONLY as part of this already-`three.js`-
// heavy chunk -- `Scene.tsx` is the app's `React.lazy` boundary specifically
// so the landing page never downloads `three`/R3F/postprocessing at all; an
// eager call from `main.tsx` would import `three` on every page load just
// for this filter, undoing that split (confirmed via `pnpm build`: it
// inflated the initial chunk by the same ~370 kB the Scene chunk shrank by).
silenceThreeClockDeprecationWarning()

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
  /** B4/T8: the GPU context died (driver crash, OS reclaiming VRAM, too many contexts open, etc). The caller shows a small recovery UI and remounts this whole component (a fresh `key`) to get a working canvas back -- WebGL context loss is notoriously unreliable to resume in place once three.js/R3F's whole resource graph (textures, buffers, shader programs) has been invalidated mid-session. */
  onContextLost?: () => void
}

/**
 * The lazy-loaded 3D chunk for the mycelium network -- what `ViewerPage`
 * renders. M4 removed the earlier tree-metaphor scene this replaced.
 *
 * Glow (P2) is SELECTIVE via a luminance-threshold `Bloom`: hyphae/hairs
 * render at ordinary brightness (below the threshold, so they stay crisp,
 * not hazy) while emissive things -- tips, fusion knots, mushroom rims, the
 * spore, and a selected/hovered hypha's additive highlight boost -- cross
 * the threshold and glow. `EffectComposer` forces the renderer's own tone
 * mapping off, so tone mapping is applied as its own effect instead
 * (`NEUTRAL`, not `ACES_FILMIC` -- the tree's V2 pass found ACES's shadow
 * toe crushes a wide range of dim values into the same too-dark output, see
 * `odd/tasks/micelio-mvp.md`).
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
  onContextLost,
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
        // B4/T8: `preventDefault()` is required by the WebGL spec for the
        // context to ever be restorable at all (otherwise the browser
        // treats the loss as permanent) -- but three.js/R3F's whole
        // resource graph (every texture/buffer/shader program) is
        // invalidated the instant this fires, so restoring THIS context in
        // place is unreliable; the caller instead shows a small recovery UI
        // and remounts the whole `<Scene>` (a fresh `key`) for a clean new
        // context. No explicit `removeEventListener` -- these listeners are
        // scoped to this canvas element's own lifetime and are discarded
        // with it on unmount, same as any other DOM node's own listeners.
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onContextLost?.()
        })
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
