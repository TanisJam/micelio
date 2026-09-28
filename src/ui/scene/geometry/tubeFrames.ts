import * as THREE from 'three'
import type { Vec3 } from '../../../domain/tree'

export interface TubeFrame {
  tangent: THREE.Vector3
  normal: THREE.Vector3
  binormal: THREE.Vector3
}

const FALLBACK_UP = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const PARALLEL_EPSILON = 1e-4

/**
 * Computes a stable perpendicular frame (tangent/normal/binormal) at each
 * point of a polyline, for extruding a tube along it. Uses a single
 * reference "up" vector for the whole polyline (chosen once, from the
 * overall start->end direction) rather than re-choosing it per ring: the
 * geometry this feeds (trunk/limb/twig tubes) only has mild curvature, so a
 * look-at frame with a *fixed* reference is visually indistinguishable from
 * a fully parallel-transported one, far simpler to test, and -- critically
 * -- avoids a ring-to-ring twist that a *per-point* reference choice would
 * cause whenever the tangent hovers near the flip threshold between rings
 * (e.g. an almost-perfectly-vertical trunk with small sway jitter).
 */
export function computeTubeFrames(points: Vec3[]): TubeFrame[] {
  if (points.length < 2) {
    throw new RangeError('computeTubeFrames requires at least two points')
  }

  const first = points[0]!
  const last = points[points.length - 1]!
  const overallDirection = new THREE.Vector3(last.x - first.x, last.y - first.y, last.z - first.z)
  if (overallDirection.lengthSq() < PARALLEL_EPSILON) overallDirection.set(0, 1, 0)
  else overallDirection.normalize()

  const reference = Math.abs(overallDirection.dot(UP)) > 1 - PARALLEL_EPSILON ? FALLBACK_UP : UP

  const frames: TubeFrame[] = []

  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)]!
    const next = points[Math.min(points.length - 1, i + 1)]!
    const tangent = new THREE.Vector3(next.x - previous.x, next.y - previous.y, next.z - previous.z)

    if (tangent.lengthSq() < PARALLEL_EPSILON) {
      tangent.copy(overallDirection)
    } else {
      tangent.normalize()
    }

    const normal = new THREE.Vector3().crossVectors(reference, tangent)
    if (normal.lengthSq() < PARALLEL_EPSILON) {
      // This point's tangent is parallel to the shared reference (rare: only
      // when the local tangent diverges sharply from the overall direction).
      // Falling back to the other axis keeps the frame finite and orthogonal.
      normal.crossVectors(FALLBACK_UP, tangent)
      if (normal.lengthSq() < PARALLEL_EPSILON) normal.crossVectors(UP, tangent)
    }
    normal.normalize()
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()

    frames.push({ tangent, normal, binormal })
  }

  return frames
}
