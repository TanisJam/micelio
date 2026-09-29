import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { buildDensityField, substrateRadiusFor, type NetworkModel } from '../../../domain/network'
import { buildDensityTexture } from './geometry/densityTexture'
import { createSubstrateMaterial, type SubstrateMaterial } from './geometry/substrateMaterial'

export interface SubstrateHazeProps {
  model: NetworkModel
  /** Reads the current growth-replay time (epoch ms) once per frame -- drives the haze's own growth reveal (Unit 3), matching the hyphae. */
  getCurrentTime: () => number
  /** The selected mushroom's own release-ring disc radius, or `null` for every other selection kind (kept from the old soil disc: "reveals its release ring as a faint hairline only while selected"). */
  ringRadius?: number | null
}

/**
 * Unit 3 ("let the substrate emerge from the mycelium"): the organic haze
 * that replaces the old geometric soil disc/plate -- a low-res density
 * field rasterized from the colony's own hyphae/hairs/mushrooms/spore
 * (`densityField.ts`, pure domain), packed into a texture and sampled by a
 * shader (`substrateMaterial.ts`) into a soft, low-contrast glow that's
 * dense where the colony is dense and fades to the flat background
 * elsewhere -- an organic, irregular silhouette instead of an ellipse, and
 * one that visibly grows alongside the hyphae during playback (each
 * texel's own recorded birth time gates its reveal, read from
 * `getCurrentTime()` every frame).
 */
export function SubstrateHaze({ model, getCurrentTime, ringRadius = null }: SubstrateHazeProps) {
  const radius = substrateRadiusFor(model)

  const field = useMemo(() => buildDensityField(model), [model])
  const densityTexture = useMemo(() => buildDensityTexture(field, model.bounds.time.firstEventTime, model.bounds.time.lastEventTime), [field, model])
  const material = useMemo(
    () =>
      createSubstrateMaterial({
        texture: densityTexture.texture,
        radius,
        timeMin: densityTexture.timeMin,
        timeMax: densityTexture.timeMax,
      }),
    [densityTexture, radius],
  )
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    return () => {
      densityTexture.texture.dispose()
      material.dispose()
    }
  }, [densityTexture, material])

  // Both the ring-radius (rare, prop-driven) and current-time (every frame)
  // uniform updates live in this ONE `useFrame` -- mutated through the mesh
  // ref, never the bare `useMemo` material value directly, which is also
  // handed straight to JSX as the `material` prop below and trips
  // `react-hooks/immutability` if mutated there (mirrors
  // `NetworkSceneContent`'s own `filamentMaterial` pattern). A second,
  // separate effect also reading/writing through the same ref (e.g. a
  // dedicated `useEffect` for `ringRadius` alone) trips the same rule a
  // different way -- reading `ringRadius` directly in the per-frame
  // callback avoids that entirely; it's a cheap prop read, not worth its
  // own effect.
  const timeMin = densityTexture.timeMin
  const timeSpan = Math.max(densityTexture.timeMax - densityTexture.timeMin, 1)

  useFrame(() => {
    const substrateMaterial = meshRef.current?.material as SubstrateMaterial | undefined
    if (!substrateMaterial) return
    // Normalized here (full double-precision JS math), never as a raw
    // epoch-ms value handed to the shader -- see `substrateMaterial.ts`'s
    // module doc for the real precision bug this fixes.
    const normalized = (getCurrentTime() - timeMin) / timeSpan
    substrateMaterial.uniforms.uCurrentTimeNorm.value = Math.min(1, Math.max(0, normalized))
    substrateMaterial.uniforms.uRingRadii.value[0] = ringRadius ?? 0
    substrateMaterial.uniforms.uRingCount.value = ringRadius !== null ? 1 : 0
  })

  return (
    // Comfortably below the lowest a hypha's own small organic y-jitter ever
    // dips (+-0.015 world units, see `colonyLayout.ts`'s `Y_JITTER`), so the
    // opaque, depth-writing haze (see `substrateMaterial.ts`'s doc) never
    // clips a filament passing just above it.
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={material}>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  )
}
