import { useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import type { NetworkModel } from '../../../domain/network'
import { soilRadiusFor } from './geometry/soilRadius'
import { createSoilMaterial } from './geometry/soilMaterial'

export interface SoilDiscProps {
  model: NetworkModel
  /** The selected mushroom's own release-ring disc radius, or `null` for every other selection kind (M3b item 3: "reveals its release ring as a faint hairline only while selected"). */
  ringRadius?: number | null
}

/**
 * The round patch of dark loam (P1's visual direction): a low-frequency
 * noisy gradient with a soft vignette falloff at the rim. Slightly larger
 * than the model's own bounding radius so hyphae never visually spill past
 * the soil's edge.
 *
 * Growth rings are deliberately NOT rendered by default (product direction,
 * M3 round 3): the owner preferred the radiating-filament/galaxy-swirl read
 * without concentric rings competing for attention -- releases are
 * communicated by mushrooms alone (see `Legend.tsx`). The one exception
 * (M3b item 3): selecting a mushroom passes its own single ring radius
 * through `ringRadius`, applied as a live uniform update (not a material
 * rebuild -- the disc geometry/base gradient never changes on selection).
 */
export function SoilDisc({ model, ringRadius = null }: SoilDiscProps) {
  const radius = soilRadiusFor(model)
  const material = useMemo(() => createSoilMaterial(radius, []), [radius])
  const meshRef = useRef<THREE.Mesh>(null)

  // Mutated through the mesh ref (never the bare `useMemo` material value
  // directly), mirroring `NetworkSceneContent`'s own `filamentMaterial`
  // pattern -- a live uniform update, not a material/geometry rebuild, so
  // selecting/deselecting a mushroom never re-creates the soil disc.
  useEffect(() => {
    const soilMaterial = meshRef.current?.material as
      | (THREE.Material & { uniforms: { uRingRadii: { value: Float32Array }; uRingCount: { value: number } } })
      | undefined
    if (!soilMaterial) return
    soilMaterial.uniforms.uRingRadii.value[0] = ringRadius ?? 0
    soilMaterial.uniforms.uRingCount.value = ringRadius !== null ? 1 : 0
  }, [ringRadius, material])

  return (
    // Comfortably below the lowest a hypha's own small organic y-jitter ever
    // dips (+-0.015 world units, see `colonyLayout.ts`'s `Y_JITTER`), so the
    // opaque, depth-writing soil (see `soilMaterial.ts`'s doc) never clips a
    // filament passing just above it.
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={material}>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  )
}
