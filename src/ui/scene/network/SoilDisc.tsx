import { useMemo } from 'react'
import type { NetworkModel } from '../../../domain/network'
import { soilRadiusFor } from './geometry/soilRadius'
import { createSoilMaterial } from './geometry/soilMaterial'

export interface SoilDiscProps {
  model: NetworkModel
}

/**
 * The round patch of dark loam (P1's visual direction): a low-frequency
 * noisy gradient with a soft vignette falloff at the rim. Slightly larger
 * than the model's own bounding radius so hyphae never visually spill past
 * the soil's edge.
 *
 * Growth rings are deliberately NOT rendered here (product direction, M3
 * round 3): the owner preferred the radiating-filament/galaxy-swirl read
 * without concentric rings competing for attention -- releases are
 * communicated by mushrooms alone (see `Legend.tsx`). The soil shader keeps
 * its ring-uniform machinery (`soilMaterial.ts`) for a possible future
 * hover/select-only reveal; this component simply never populates it.
 */
export function SoilDisc({ model }: SoilDiscProps) {
  const radius = soilRadiusFor(model)
  const material = useMemo(() => createSoilMaterial(radius, []), [radius])

  return (
    // Comfortably below the lowest a hypha's own small organic y-jitter ever
    // dips (+-0.015 world units, see `colonyLayout.ts`'s `Y_JITTER`), so the
    // opaque, depth-writing soil (see `soilMaterial.ts`'s doc) never clips a
    // filament passing just above it.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={material}>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  )
}
