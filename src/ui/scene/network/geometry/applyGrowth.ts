import * as THREE from 'three'
import { isGrown } from '../../../../domain/network'

/** A3/T8: how much bigger a hovered/selected instance (mushroom, tip, fusion knot) renders -- a quiet, unmistakable "this is the thing under your cursor" cue for point-like elements that have no "whole hypha" to highlight. */
export const HIGHLIGHT_SCALE = 1.4

/**
 * Unit 4 ("replay history event by event"): how much bigger a just-grown
 * instance renders right at its own birth time, decaying back to its real
 * scale over `flashWindowMs` -- a mushroom's "sprouts (scale-up) with a
 * soft pulse" and a fusion knot's "brief warm flash", both driven by the
 * SAME mechanism (an instance's own recorded birth time), not a separate
 * one-shot animation system.
 */
export const FLASH_PEAK_SCALE = 1.8

/** A mushroom's own sprout window -- long enough to read as a deliberate scale-up, not a snap. */
export const MUSHROOM_SPROUT_WINDOW_MS = 900
/** A fusion knot's own flash window -- shorter and snappier than a mushroom's sprout, reading as a brief pulse rather than a growth. */
export const FUSION_FLASH_WINDOW_MS = 450

/**
 * Per-frame growth reveal for an `InstancedMesh` (mushrooms, fusion knots,
 * growing tips): a not-yet-grown instance is moved far away AND scaled to
 * zero (not just one or the other -- a renderer can treat a fully
 * degenerate zero-scale instance as a stray pixel, a caution carried over
 * from the tree's own `ScatterInstances`, see `odd/tasks/micelio-mvp.md`
 * T5). Mutates the mesh's `instanceMatrix` in place; no geometry rebuild.
 *
 * `highlightIndex` (default `-1`, meaning none) scales that one grown
 * instance up by `HIGHLIGHT_SCALE` -- the hover/select affordance for
 * point-like elements (A3/T8) that aren't part of a hypha ribbon, so can't
 * use the shared growth shader's hypha-highlight uniforms.
 *
 * `flashWindowMs` (default 0, meaning no flash) makes a JUST-grown instance
 * (`currentTime` within `flashWindowMs` of its own `birthTime`) render
 * bigger than its real scale, easing back down to it -- combines
 * multiplicatively with the highlight scale on the rare frame both apply.
 */
export function applyGrowthToInstances(
  mesh: THREE.InstancedMesh,
  matrices: THREE.Matrix4[],
  birthTimes: number[],
  currentTime: number,
  highlightIndex = -1,
  flashWindowMs = 0,
): void {
  const scratch = new THREE.Matrix4()
  for (let i = 0; i < matrices.length; i++) {
    const birthTime = birthTimes[i]!
    if (isGrown(birthTime, currentTime)) {
      let scale = i === highlightIndex ? HIGHLIGHT_SCALE : 1

      if (flashWindowMs > 0) {
        const age = currentTime - birthTime
        if (age >= 0 && age < flashWindowMs) {
          const t = age / flashWindowMs // 0 (just born) .. 1 (flash over)
          const eased = 1 - t * t // decays faster at first, settling smoothly
          scale *= 1 + (FLASH_PEAK_SCALE - 1) * eased
        }
      }

      if (scale !== 1) {
        scratch.copy(matrices[i]!)
        scratch.scale(new THREE.Vector3(scale, scale, scale))
        mesh.setMatrixAt(i, scratch)
      } else {
        mesh.setMatrixAt(i, matrices[i]!)
      }
    } else {
      scratch.copy(matrices[i]!)
      scratch.setPosition(0, -1000, 0)
      scratch.scale(new THREE.Vector3(0, 0, 0))
      mesh.setMatrixAt(i, scratch)
    }
  }
  mesh.instanceMatrix.needsUpdate = true
}
