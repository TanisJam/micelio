import * as THREE from 'three'
import { isGrown } from '../../../../domain/network'

/**
 * Per-frame growth reveal for an `InstancedMesh` (mushrooms, fusion knots,
 * growing tips): a not-yet-grown instance is moved far away AND scaled to
 * zero (not just one or the other -- a renderer can treat a fully
 * degenerate zero-scale instance as a stray pixel, a caution carried over
 * from the tree's own `ScatterInstances`, see `odd/tasks/huerto-mvp.md`
 * T5). Mutates the mesh's `instanceMatrix` in place; no geometry rebuild.
 */
export function applyGrowthToInstances(mesh: THREE.InstancedMesh, matrices: THREE.Matrix4[], birthTimes: number[], currentTime: number): void {
  const scratch = new THREE.Matrix4()
  for (let i = 0; i < matrices.length; i++) {
    if (isGrown(birthTimes[i]!, currentTime)) {
      mesh.setMatrixAt(i, matrices[i]!)
    } else {
      scratch.copy(matrices[i]!)
      scratch.setPosition(0, -1000, 0)
      scratch.scale(new THREE.Vector3(0, 0, 0))
      mesh.setMatrixAt(i, scratch)
    }
  }
  mesh.instanceMatrix.needsUpdate = true
}
