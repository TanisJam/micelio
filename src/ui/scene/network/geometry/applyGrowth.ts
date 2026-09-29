import * as THREE from 'three'
import { isGrown } from '../../../../domain/network'

/** A3/T8: how much bigger a hovered/selected instance (mushroom, tip, fusion knot) renders -- a quiet, unmistakable "this is the thing under your cursor" cue for point-like elements that have no "whole hypha" to highlight. */
export const HIGHLIGHT_SCALE = 1.4

/**
 * Per-frame growth reveal for an `InstancedMesh` (mushrooms, fusion knots,
 * growing tips): a not-yet-grown instance is moved far away AND scaled to
 * zero (not just one or the other -- a renderer can treat a fully
 * degenerate zero-scale instance as a stray pixel, a caution carried over
 * from the tree's own `ScatterInstances`, see `odd/tasks/huerto-mvp.md`
 * T5). Mutates the mesh's `instanceMatrix` in place; no geometry rebuild.
 *
 * `highlightIndex` (default `-1`, meaning none) scales that one grown
 * instance up by `HIGHLIGHT_SCALE` -- the hover/select affordance for
 * point-like elements (A3/T8) that aren't part of a hypha ribbon, so can't
 * use the shared growth shader's hypha-highlight uniforms.
 */
export function applyGrowthToInstances(
  mesh: THREE.InstancedMesh,
  matrices: THREE.Matrix4[],
  birthTimes: number[],
  currentTime: number,
  highlightIndex = -1,
): void {
  const scratch = new THREE.Matrix4()
  for (let i = 0; i < matrices.length; i++) {
    if (isGrown(birthTimes[i]!, currentTime)) {
      if (i === highlightIndex) {
        scratch.copy(matrices[i]!)
        scratch.scale(new THREE.Vector3(HIGHLIGHT_SCALE, HIGHLIGHT_SCALE, HIGHLIGHT_SCALE))
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
