import * as THREE from 'three'
import { hexToRgb } from '../../../theme/color'
import { mycelium } from '../../../theme/tokens'

/**
 * A stylized mushroom (cap + stem), built once as a shared `LatheGeometry`
 * (revolved profile) and rendered `InstancedMesh`-many for every release
 * (P12: one draw call regardless of release count). Cream cap with a cyan
 * emissive-reading rim (P1) via per-vertex color, computed procedurally
 * (LatheGeometry has no per-band color of its own).
 */

const RADIAL_SEGMENTS = 10
const STEM_TOP_Y = 0.4
const CAP_UNDERSIDE_Y = 0.44
const CAP_TOP_Y = 0.62
const RIM_BAND = 0.03

const PROFILE: THREE.Vector2[] = [
  new THREE.Vector2(0.0, 0),
  new THREE.Vector2(0.12, 0),
  new THREE.Vector2(0.14, STEM_TOP_Y * 0.5),
  new THREE.Vector2(0.13, STEM_TOP_Y),
  new THREE.Vector2(0.5, CAP_UNDERSIDE_Y),
  new THREE.Vector2(0.56, CAP_UNDERSIDE_Y + 0.03),
  new THREE.Vector2(0.4, CAP_TOP_Y * 0.85),
  new THREE.Vector2(0.0, CAP_TOP_Y),
]

let cached: THREE.BufferGeometry | null = null

/** Shared, module-cached mushroom geometry -- built once, reused by every `InstancedMesh` instance. */
export function getMushroomGeometry(): THREE.BufferGeometry {
  if (cached) return cached

  const geometry = new THREE.LatheGeometry(PROFILE, RADIAL_SEGMENTS)
  const position = geometry.getAttribute('position')
  const cap = hexToRgb(mycelium.mushroomCap)
  const rim = hexToRgb(mycelium.mushroomRim)
  const stem = hexToRgb(mycelium.hyphaLiveBranch)
  const colors = new Float32Array(position.count * 3)

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    let rgb = cap
    if (Math.abs(y - CAP_UNDERSIDE_Y) < RIM_BAND) rgb = rim
    else if (y < STEM_TOP_Y) rgb = stem
    colors[i * 3] = rgb.r / 255
    colors[i * 3 + 1] = rgb.g / 255
    colors[i * 3 + 2] = rgb.b / 255
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  cached = geometry
  return geometry
}
