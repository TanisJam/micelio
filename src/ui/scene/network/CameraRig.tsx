import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { NetworkModel } from '../../../domain/network'
import { chooseCameraFraming, computeFramingDistance, computeGrownRadius } from './cameraFraming'

/** Unit 4: how fast the camera gently auto-orbits while growth replay is actively playing -- slow enough to read as "staying with the colony", never a distracting spin. `OrbitControls.autoRotateSpeed`'s own units: degrees per second at 60fps, roughly. */
const REPLAY_AUTO_ROTATE_SPEED = 0.35

/**
 * Post-final-pass (framing): how quickly the camera's distance eases toward
 * its target while actively replaying (see the `useFrame` below) -- a
 * `THREE.MathUtils.damp` time constant in seconds, NOT a linear speed. Low
 * enough that a sudden jump in grown radius (e.g. several hyphae splitting
 * in the same tick) still eases out smoothly over roughly half a second
 * rather than snapping.
 */
const FRAMING_EASE_TIME_CONSTANT = 0.6
/** A colony with nothing grown yet (radius 0) still frames at roughly this world-unit radius, so the very first frame isn't a divide-by-zero/degenerate extreme close-up on the spore. */
const MIN_GROWN_RADIUS = 0.75

export interface CameraRigProps {
  model: NetworkModel
  /** Reads the current growth-replay time (epoch ms) once per frame -- drives the "ease out as it grows" framing while replay is actively playing (see the module doc). */
  getCurrentTime: () => number
  /**
   * Unit 4: reads the growth clock's own play state once per frame (never a
   * reactive prop -- the clock deliberately stays outside React state, see
   * `useGrowthClock`'s doc comment) to gate a gentle auto-orbit while replay
   * is actively playing. Omitted (or `reducedMotion`) disables it entirely.
   */
  isReplayPlaying?: () => boolean
  reducedMotion?: boolean
}

/**
 * Positions the perspective camera to frame the whole colony disc on load
 * (accounting for both vertical and horizontal FOV, so a narrow mobile
 * viewport doesn't crop the disc's width), and sets up damped
 * `OrbitControls` with polar/distance limits so the viewer can never orbit
 * below the substrate or clip through the spore.
 *
 * Post-final-pass (framing): frames against the model's own TRUE bounding
 * radius (`model.bounds.radius`) rather than the substrate haze's PADDED
 * radius (`substrateRadiusFor(model)`, `DENSITY_FIELD_MARGIN` = 1.6x
 * larger) -- the earlier padded framing left the colony filling only
 * roughly 40% of the viewport's limiting dimension on a real repo
 * screenshot (`pmndrs/valtio`), well short of the intended "colony fills
 * most of the view" read. `cameraFraming.ts`'s margins are retuned
 * alongside this fix for a ~85% fill target.
 *
 * Unit 4 + post-final-pass: while growth replay is actively playing (and
 * the viewer hasn't yet touched the camera themselves), a slow auto-orbit
 * keeps the growing colony gently in view rather than sitting static, AND
 * the framing distance eases outward toward whatever the colony's CURRENT
 * grown extent (`computeGrownRadius`) actually needs -- so early replay
 * (a couple of hyphae near the spore) reads as a close-up rather than
 * already sitting at the fully-grown colony's final, zoomed-out distance.
 * The FIRST manual interaction (drag/zoom/pan) permanently hands control
 * back for the rest of this mount, per the task's own "returns control on
 * interaction"; a paused/pinned time (`?t=`, scrubbing) always frames
 * against the final `model.bounds.radius`, never the eased/current one, so
 * a paused view never unexpectedly reframes itself.
 */
export function CameraRig({ model, getCurrentTime, isReplayPlaying, reducedMotion = false }: CameraRigProps) {
  const { camera, size } = useThree()
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const hasInteracted = useRef(false)
  const target: [number, number, number] = [0, 0, 0]

  const radius = model.bounds.radius

  const verticalFov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
  const aspect = size.height > 0 ? size.width / size.height : 1
  // D2/T8: a narrow/portrait viewport gets a steeper pitch and a tighter
  // frame margin -- see `cameraFraming.ts`'s doc comment for why the fixed
  // desktop-tuned 45deg pitch left large empty bands above/below on mobile.
  const { pitchRadians, frameMargin } = chooseCameraFraming(aspect)
  const framingDistance = computeFramingDistance(radius, verticalFov, aspect, frameMargin)
  // M3c round-4 orchestrator finding: a static `maxDistance` (previously
  // `radius * 4.5`) clamps the camera BACK toward the disc right after the
  // effect below sets it -- `OrbitControls.update()` enforces its own
  // min/maxDistance on every call, including the one this effect makes right
  // after positioning the camera. For a landscape viewport `framingDistance`
  // (~3.6x radius at a 1440x900 desktop) stayed comfortably under the old
  // 4.5x cap, so the bug never showed there -- but a narrow portrait phone
  // (~7.3x radius at 390x844) needs FAR more distance to fit the disc's
  // width, got silently clamped back down to 4.5x, and cropped the disc's
  // left/right edges. `maxDistance` must scale with the same framing
  // distance this component actually uses, with real headroom (not just
  // barely enough) so the user can still orbit/zoom out a bit further.
  const maxDistance = Math.max(radius * 4.5, framingDistance * 1.6)

  useEffect(() => {
    camera.position.set(0, framingDistance * Math.sin(pitchRadians), framingDistance * Math.cos(pitchRadians))
    camera.lookAt(0, 0, 0)
    controlsRef.current?.target.set(0, 0, 0)
    controlsRef.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, size.width, size.height])

  useFrame((_state, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const playing = !reducedMotion && !hasInteracted.current && (isReplayPlaying?.() ?? false)
    controls.autoRotate = playing
    controls.autoRotateSpeed = REPLAY_AUTO_ROTATE_SPEED

    // Post-final-pass: ease the framing distance out toward the colony's
    // CURRENT grown extent while actively replaying -- preserves whatever
    // azimuth/polar angle the camera already has (including from the
    // auto-rotate above) and only adjusts the radial distance, so this
    // never fights `OrbitControls`' own per-frame update: it recomputes its
    // internal spherical state fresh from `camera.position` every call,
    // rather than caching it independently.
    if (playing) {
      const grownRadius = Math.max(computeGrownRadius(model, getCurrentTime()), MIN_GROWN_RADIUS)
      const targetDistance = computeFramingDistance(grownRadius, verticalFov, aspect, frameMargin)
      const offset = camera.position.clone().sub(controls.target as THREE.Vector3)
      const currentDistance = offset.length()
      if (currentDistance > 1e-6) {
        const easedDistance = THREE.MathUtils.damp(currentDistance, targetDistance, 1 / FRAMING_EASE_TIME_CONSTANT, delta)
        camera.position.copy(controls.target as THREE.Vector3).addScaledVector(offset.normalize(), easedDistance)
      }
    }
    controls.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(radius * 0.5, 1)}
      maxDistance={maxDistance}
      // Never dip below the substrate (a small positive floor), and never go
      // fully overhead either -- keeps the 3/4 read intact while orbiting.
      minPolarAngle={0.35}
      maxPolarAngle={1.45}
      target={target}
      // Unit 4: the first real user interaction hands control back for
      // good (`hasInteracted`, read by the `useFrame` above) -- `onStart`
      // fires on drag/zoom/pan start, never on the auto-rotate itself.
      onStart={() => {
        hasInteracted.current = true
      }}
      makeDefault
    />
  )
}
