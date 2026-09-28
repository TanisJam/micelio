import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { computeModelBounds, type TreeModel } from '../../domain/tree'
import { buildSkyTexture } from './geometry/skyTexture'
import { palette } from '../theme/tokens'
import { TreeScene } from './tree/TreeScene'

export interface SceneProps {
  model: TreeModel
  getCurrentTime: () => number
  reducedMotion: boolean
  onElementHover?: (id: string | null) => void
  onElementSelect?: (id: string) => void
}

/**
 * The lazy-loaded 3D chunk: owns the R3F `Canvas` (shadows, tone mapping,
 * color management, fog) and renders the tree diorama inside it. Exported
 * as the default so `App.tsx` can `React.lazy(() => import('./scene/Scene'))`
 * and keep the initial bundle light (P12).
 */
export default function Scene({ model, getCurrentTime, reducedMotion, onElementHover, onElementSelect }: SceneProps) {
  const bounds = useMemo(() => computeModelBounds(model), [model])

  return (
    <Canvas
      shadows="variance"
      camera={{ fov: 42, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = THREE.SRGBColorSpace
        scene.fog = new THREE.Fog(new THREE.Color(palette.fog), bounds.radius * 1.6, bounds.radius * 6.5)
        scene.background = buildSkyTexture(palette.skyTop, palette.skyHorizon)
      }}
    >
      <TreeScene
        model={model}
        getCurrentTime={getCurrentTime}
        reducedMotion={reducedMotion}
        onElementHover={onElementHover}
        onElementSelect={onElementSelect}
      />
    </Canvas>
  )
}
