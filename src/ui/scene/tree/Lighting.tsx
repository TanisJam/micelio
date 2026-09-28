import type { ModelBounds } from '../../../domain/tree'
import { palette } from '../../theme/tokens'

export interface LightingProps {
  bounds: ModelBounds
}

/** Hemisphere fill + directional "sun" with soft shadows sized to the tree's bounds (P2). */
export function Lighting({ bounds }: LightingProps) {
  // The directional light's target stays at the world origin (three.js
  // default), which is where the trunk is always rooted -- so the shadow
  // frustum is sized generously around the origin rather than `bounds.center`.
  const centerOffset = Math.hypot(bounds.center.x, bounds.center.z)
  const shadowExtent = Math.max((bounds.radius + centerOffset) * 1.2, 2)
  const sunDistance = bounds.radius * 2.2

  return (
    <>
      <hemisphereLight args={[palette.skyTop, palette.soilRock, 0.65]} />
      <directionalLight
        color={palette.skyTop}
        position={[sunDistance * 0.6, sunDistance, sunDistance * 0.4]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={sunDistance * 2.5}
        shadow-bias={-0.0015}
        shadow-radius={4}
        shadow-blurSamples={12}
      />
      <ambientLight intensity={0.25} color={palette.fog} />
    </>
  )
}
