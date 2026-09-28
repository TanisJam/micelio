import * as THREE from 'three'
import type { Vec3 } from '../../../domain/tree'
import { computeTubeFrames } from './tubeFrames'

export interface TubeGeometryPoint {
  position: Vec3
  radius: number
}

export interface TubeGeometryResult {
  geometry: THREE.BufferGeometry
  /** Number of rings (one per input point). */
  ringCount: number
  /** Index-buffer entries contributed per ring-to-ring step; multiply by a ring-step count to build a `drawRange`. */
  indicesPerRingStep: number
}

/**
 * Builds a low-poly tapered tube along a polyline: one ring of
 * `radialSegments` vertices per point, radius taken from each point. Meant
 * for trunk/limb tubes (flat-shaded via the material, not the geometry --
 * see `TrunkMesh`/`LimbMeshes`). Indices are appended ring-by-ring so a
 * caller can reveal the tube progressively with `geometry.setDrawRange` for
 * the growth time-lapse (T5), without rebuilding geometry every frame.
 */
export function buildTubeGeometry(points: TubeGeometryPoint[], radialSegments: number): TubeGeometryResult {
  if (points.length < 2) {
    throw new RangeError('buildTubeGeometry requires at least two points')
  }
  if (radialSegments < 3) {
    throw new RangeError('buildTubeGeometry requires at least 3 radial segments')
  }

  const frames = computeTubeFrames(points.map((p) => p.position))
  const ringCount = points.length

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let ring = 0; ring < ringCount; ring++) {
    const { position, radius } = points[ring]!
    const { normal, binormal } = frames[ring]!
    const center = new THREE.Vector3(position.x, position.y, position.z)

    for (let seg = 0; seg <= radialSegments; seg++) {
      const angle = (seg / radialSegments) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      const offset = new THREE.Vector3()
        .addScaledVector(normal, cos * radius)
        .addScaledVector(binormal, sin * radius)
      const vertex = new THREE.Vector3().addVectors(center, offset)
      const vertexNormal = offset.clone().normalize()

      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(vertexNormal.x, vertexNormal.y, vertexNormal.z)
      uvs.push(seg / radialSegments, ring / (ringCount - 1))
    }
  }

  const verticesPerRing = radialSegments + 1
  const indicesPerRingStep = radialSegments * 6

  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let seg = 0; seg < radialSegments; seg++) {
      const a = ring * verticesPerRing + seg
      const b = a + verticesPerRing
      const c = a + 1
      const d = b + 1

      indices.push(a, b, c)
      indices.push(c, b, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.setDrawRange(0, indices.length)

  return { geometry, ringCount, indicesPerRingStep }
}

/**
 * Computes a `[start, count]` draw range revealing `progress` (0..1) of a
 * tube built by `buildTubeGeometry`. Rounds *up* to the next ring
 * (`Math.ceil`, not `Math.round`): a limb's ring granularity is much
 * coarser than its twig count, so rounding to the *nearest* ring could
 * under-cover a twig that has already sprouted at a position just past the
 * midpoint of the last ring step, leaving it floating past the visibly
 * drawn tip. Rounding up guarantees the drawn length is always >= `progress`.
 */
export function drawRangeForProgress(result: TubeGeometryResult, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  const ringSteps = result.ringCount - 1
  const steps = Math.ceil(clamped * ringSteps)
  return steps * result.indicesPerRingStep
}
