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
  /** Unit 4: reads the growth clock's own play state once per frame -- see `CameraRig`'s doc comment for the gentle auto-orbit this drives. */
  isReplayPlaying?: () => boolean
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
  isReplayPlaying,
  onElementHover,
  onElementSelect,
  hoveredId = null,
  selectedId = null,
  onCanvasReady,
  onContextLost,
}: NetworkSceneProps) {
  // A FLAT background (not the tree scene's vertical sky gradient, see
  // `skyTexture.ts` -- deliberately not reused here), pure near-black
  // (`mycelium.substrateFar`). Round-3: the earlier density-texture
  // substrate mesh that used to fade INTO this exact color at its own rim is
  // gone entirely (see `NetworkSceneContent.tsx`'s module doc) -- the scene
  // now sits on flat black with no mesh/texture haze at all; whatever soft
  // glow the colony has comes only from the wide/soft second `Bloom` pass
  // below, scattering real light off the hyphae's own rendered pixels.
  const background = useMemo(() => new THREE.Color(mycelium.substrateFar), [])

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
        isReplayPlaying={isReplayPlaying}
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
        {/* Round-3 orchestrator finding: the density-texture substrate mesh
            (a rasterized field sampled into a low-res texture) read as a
            blocky, pixelated disc with hard edges and holes -- removed
            entirely (`NetworkSceneContent.tsx`'s module doc). This second,
            much wider and dimmer `Bloom` pass replaces it: it reads the SAME
            rendered hyphae/hair/spore/mushroom pixels already on screen (no
            separate mesh, no texture) at a much LOWER threshold than the
            pass above, so ordinary (not just emissive) thread brightness
            also contributes, then spreads that light with `mipmapBlur`'s
            downsample/upsample chain (`levels`, `radius`) -- inherently
            smooth, never blocky/pixelated, since it blurs across continuous
            mip levels rather than sampling a fixed-resolution grid. Low
            `intensity` keeps it a faint haze, not a second bright glow: pure
            black background pixels stay at ~0 luminance and never
            contribute, so the haze exists ONLY where the colony has grown,
            and only ever ADDS on top of the crisp base render -- the first
            `Bloom` pass and the ordinary thread render above stay exactly as
            crisp as before. If a future repo/scale makes this read as
            anything other than a faint, smooth nebula haze, lower
            `intensity` further (never texture-based blur) rather than
            reinstating a substrate mesh. */}
        <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.55} intensity={0.16} radius={0.92} levels={9} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
