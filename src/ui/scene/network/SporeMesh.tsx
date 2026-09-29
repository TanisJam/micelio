import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mycelium } from '../../theme/tokens'
import { clampWorldRadiusForScreenSize } from './screenSizeClamp'

export interface SporeMeshProps {
  reducedMotion: boolean
  /** A3/T8: the spore is a real pickable element (id `'spore'`, resolves to the repo overview) -- hover/select brightens its halo, since it isn't part of any hypha ribbon and so can't use the shared growth shader's highlight uniforms. */
  highlighted?: boolean
}

const CORE_RADIUS = 0.05
const HALO_RADIUS = 0.15
// Round-3 orchestrator finding (task C): "the green halo ring around the
// spore is too big/opaque at close zoom" -- both toned down from 0.22/0.5.
const HALO_OPACITY = 0.14
const HALO_OPACITY_HIGHLIGHTED = 0.32
/** Task B/C: the halo's own on-screen radius never exceeds this many pixels, regardless of camera distance -- see `screenSizeClamp.ts`'s module doc. Prevents the halo from ever reading as a "giant disc" at an aggressively close replay zoom. */
const HALO_MAX_PIXEL_RADIUS = 46

/**
 * The spore (first commit / repo root, P9's legend entry): a small bright
 * core with a soft halo. Deliberately modest brightness/size (P1: "the dense
 * center must not blow out into a white sun -- limit its bloom") -- the core
 * color is a near-white mint rather than pure white, and the halo is a large,
 * low-opacity additive sphere rather than a second hard-edged bright one.
 * Gentle idle "breathing" glow (P4), disabled under `prefers-reduced-motion`.
 */
export function SporeMesh({ reducedMotion, highlighted = false }: SporeMeshProps) {
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!haloRef.current) return
    const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.06
    const desiredScale = highlighted ? pulse * 1.35 : pulse
    const desiredRadius = HALO_RADIUS * desiredScale
    // The spore always sits at the world origin (`colonyLayout.ts`'s
    // `spore.position`) and `CameraRig`'s orbit target is also the origin,
    // so distance-to-camera is simply the camera's own distance from (0,0,0).
    const distance = state.camera.position.length()
    const camera = state.camera
    const verticalFov = 'fov' in camera ? THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) : Math.PI / 4
    const cappedRadius = clampWorldRadiusForScreenSize(desiredRadius, distance, verticalFov, state.size.height, HALO_MAX_PIXEL_RADIUS)
    haloRef.current.scale.setScalar(cappedRadius / HALO_RADIUS)
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[CORE_RADIUS, 16, 16]} />
        <meshBasicMaterial color={mycelium.sporeCore} toneMapped={false} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[HALO_RADIUS, 16, 16]} />
        {/* M3c item 2: a touch more bloom on the spore halo (0.16 -> 0.22) to
            help restore the brighter, more luminous read from before M3b's
            palette/brightness pass, while staying well short of "blown out". */}
        <meshBasicMaterial
          color={mycelium.sporeHalo}
          transparent
          opacity={highlighted ? HALO_OPACITY_HIGHLIGHTED : HALO_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
