/**
 * A plain 3D vector. Deliberately not a three.js `Vector3` -- the domain
 * layer must not depend on three.js. The UI layer converts these as needed.
 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function scaleVec3(a: Vec3, scalar: number): Vec3 {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar }
}

export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function vec3Length(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
}

/** Point at horizontal `radius` and `height`, at `azimuth` radians around the Y axis. */
export function polarToVec3(azimuth: number, radius: number, height: number): Vec3 {
  return { x: Math.cos(azimuth) * radius, y: height, z: Math.sin(azimuth) * radius }
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

/** Unit-length copy of `a`, or `fallback` (default +Z) when `a` is (near-)zero -- never NaN/Infinity. */
export function normalizeVec3(a: Vec3, fallback: Vec3 = { x: 0, y: 0, z: 1 }): Vec3 {
  const length = vec3Length(a)
  if (length < 1e-9) return fallback
  return scaleVec3(a, 1 / length)
}
