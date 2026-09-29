import { addVec3, scaleVec3, subVec3, vec3Length, type Vec3 } from '../shared/vector'
import { lerp } from '../math'

/**
 * Centripetal Catmull-Rom spline sampling, generalized to also carry
 * per-point `radius`/`time` scalars (linearly interpolated per segment,
 * alongside the cubic position). Every division is guarded against
 * near-zero denominators (falling back to a plain average) so degenerate
 * (coincident or near-coincident) control points can never produce
 * NaN/Infinity -- a hard requirement for the network model.
 */

export interface SplineControlPoint {
  position: Vec3
  radius: number
  time: number
}

export type SplineSample = SplineControlPoint

const EPSILON = 1e-6

function segmentKnotDelta(a: Vec3, b: Vec3, alpha: number): number {
  const distance = vec3Length(subVec3(b, a))
  return Math.pow(Math.max(distance, EPSILON), alpha)
}

/** Weighted blend of two points normalized by `denom`; averages instead of dividing when `denom` is ~0. */
function lerpWeighted(a: Vec3, weightA: number, b: Vec3, weightB: number, denom: number): Vec3 {
  if (Math.abs(denom) < EPSILON) return scaleVec3(addVec3(a, b), 0.5)
  return addVec3(scaleVec3(a, weightA / denom), scaleVec3(b, weightB / denom))
}

/** One centripetal Catmull-Rom point on the segment [p1, p2] (using neighbors p0, p3), at local t in [0, 1]. */
function catmullRomSegmentPoint(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, localT: number, alpha = 0.5): Vec3 {
  const t0 = 0
  const t1 = t0 + segmentKnotDelta(p0, p1, alpha)
  const t2 = t1 + segmentKnotDelta(p1, p2, alpha)
  const t3 = t2 + segmentKnotDelta(p2, p3, alpha)
  const t = t1 + (t2 - t1) * localT

  const a1 = lerpWeighted(p0, t1 - t, p1, t - t0, t1 - t0)
  const a2 = lerpWeighted(p1, t2 - t, p2, t - t1, t2 - t1)
  const a3 = lerpWeighted(p2, t3 - t, p3, t - t2, t3 - t2)
  const b1 = lerpWeighted(a1, t2 - t, a2, t - t0, t2 - t0)
  const b2 = lerpWeighted(a2, t3 - t, a3, t - t1, t3 - t1)
  return lerpWeighted(b1, t2 - t, b2, t - t1, t2 - t1)
}

/**
 * Samples a smooth centripetal Catmull-Rom curve through `controlPoints`
 * (>= 1), `samplesPerSegment` steps per pair of consecutive control points.
 * The curve passes exactly through every control point (including the
 * first and last -- important for tangent-continuous fusion joints).
 * Endpoint tangents use a duplicated-endpoint phantom (not a reflection),
 * which is the standard, simplest way to terminate an open Catmull-Rom
 * curve without extrapolating past the real data.
 */
export function sampleCatmullRomCentripetal(
  controlPoints: SplineControlPoint[],
  samplesPerSegment: number,
): SplineSample[] {
  if (controlPoints.length === 0) return []
  if (controlPoints.length === 1) {
    const only = controlPoints[0]!
    return [{ position: only.position, radius: only.radius, time: only.time }]
  }

  const steps = Math.max(1, Math.floor(samplesPerSegment))
  const positions = controlPoints.map((c) => c.position)
  const padded = [positions[0]!, ...positions, positions[positions.length - 1]!]

  const result: SplineSample[] = []
  const segmentCount = controlPoints.length - 1
  for (let segment = 0; segment < segmentCount; segment++) {
    const p0 = padded[segment]!
    const p1 = padded[segment + 1]!
    const p2 = padded[segment + 2]!
    const p3 = padded[segment + 3]!
    const c1 = controlPoints[segment]!
    const c2 = controlPoints[segment + 1]!
    // Include the segment's final sample only on the last segment, so the
    // curve's own end point is emitted exactly once (not duplicated across
    // consecutive segments).
    const stepsInSegment = segment === segmentCount - 1 ? steps + 1 : steps
    for (let i = 0; i < stepsInSegment; i++) {
      const localT = i / steps
      result.push({
        position: catmullRomSegmentPoint(p0, p1, p2, p3, localT),
        radius: lerp(c1.radius, c2.radius, localT),
        time: lerp(c1.time, c2.time, localT),
      })
    }
  }
  return result
}
