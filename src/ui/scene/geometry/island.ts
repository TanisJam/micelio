import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createPrng, randJitter, type Prng, type SoilStratum } from '../../../domain/tree'
import { hexToRgb } from '../../theme/color'
import { palette, soilStratumColor } from '../../theme/tokens'

const RADIAL_SEGMENTS = 9
const TOP_RADIUS = 1.7
const BOTTOM_RADIUS = 0.12
const TOTAL_DEPTH = 1.3
const GRASS_HEIGHT = 0.12
const RADIUS_JITTER = 0.09
const HEIGHT_JITTER = 0.03

/** Island footprint, exposed so the contact shadow can be sized/positioned to match. */
export const ISLAND_TOP_RADIUS = TOP_RADIUS
export const ISLAND_DEPTH = TOTAL_DEPTH

function setVertexColor(geometry: THREE.BufferGeometry, hex: string): void {
  const { r, g, b } = hexToRgb(hex)
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r / 255
    colors[i * 3 + 1] = g / 255
    colors[i * 3 + 2] = b / 255
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

function jitterRadius(geometry: THREE.BufferGeometry, prng: Prng, amount: number): void {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const radius = Math.hypot(x, z)
    if (radius < 1e-6) continue
    const jitter = 1 + randJitter(prng, amount)
    position.setX(i, x * jitter)
    position.setZ(i, z * jitter)
  }
  position.needsUpdate = true
}

/**
 * Builds the floating soil island as a single merged, vertex-colored,
 * flat-shaded geometry: a stack of tapering strata bands (one per
 * `SoilStratum`, colored by softened real GitHub language color) sitting on
 * an irregular rocky point, capped by a bumpy grass disc. No roots (out of
 * MVP scope). One draw call.
 */
export function buildIslandGeometry(soil: SoilStratum[], seed: string): THREE.BufferGeometry {
  const prng = createPrng(`${seed}-island`)
  const sorted = [...soil].sort((a, b) => a.offset - b.offset)
  const strataHeight = TOTAL_DEPTH - GRASS_HEIGHT

  const parts: THREE.BufferGeometry[] = []

  // Bottom rocky point, closing off the underside.
  const tip = new THREE.ConeGeometry(BOTTOM_RADIUS * 1.4, HEIGHT_JITTER * 4, RADIAL_SEGMENTS)
  tip.rotateX(Math.PI)
  tip.translate(0, -strataHeight, 0)
  jitterRadius(tip, prng, RADIUS_JITTER * 0.6)
  setVertexColor(tip, palette.soilRock)
  parts.push(tip)

  for (const stratum of sorted) {
    const bottomY = -strataHeight * (1 - stratum.offset)
    const topY = -strataHeight * (1 - Math.min(1, stratum.offset + stratum.share))
    const height = Math.max(topY - bottomY, 0.001)

    const bottomRadius = THREE.MathUtils.lerp(BOTTOM_RADIUS, TOP_RADIUS, stratum.offset)
    const topRadius = THREE.MathUtils.lerp(BOTTOM_RADIUS, TOP_RADIUS, Math.min(1, stratum.offset + stratum.share))

    const band = new THREE.CylinderGeometry(topRadius, bottomRadius, height, RADIAL_SEGMENTS, 1, true)
    band.translate(0, bottomY + height / 2, 0)
    jitterRadius(band, prng, RADIUS_JITTER)
    setVertexColor(band, soilStratumColor(stratum.color))
    parts.push(band)
  }

  // Grass cap: a bumpy low-poly disc sitting on top.
  const grass = new THREE.CylinderGeometry(TOP_RADIUS * 1.03, TOP_RADIUS * 0.97, GRASS_HEIGHT, RADIAL_SEGMENTS, 1, false)
  grass.translate(0, GRASS_HEIGHT / 2, 0)
  const grassPosition = grass.getAttribute('position')
  const CENTER_VERTEX_RADIUS = TOP_RADIUS * 0.1
  for (let i = 0; i < grassPosition.count; i++) {
    const x = grassPosition.getX(i)
    const z = grassPosition.getZ(i)
    // Skip the top cap's fan-center vertex (and near-center ones): jittering
    // it would spike a thin degenerate triangle straight up through the
    // trunk base instead of a gentle bump.
    if (grassPosition.getY(i) > 0 && Math.hypot(x, z) > CENTER_VERTEX_RADIUS) {
      grassPosition.setY(i, grassPosition.getY(i) + randJitter(prng, HEIGHT_JITTER))
    }
  }
  grassPosition.needsUpdate = true
  jitterRadius(grass, prng, RADIUS_JITTER * 0.5)
  setVertexColor(grass, palette.grass)
  parts.push(grass)

  for (const part of parts) part.computeVertexNormals()

  const merged = mergeGeometries(parts, false)
  if (!merged) {
    throw new Error('Failed to merge island geometry parts')
  }
  for (const part of parts) part.dispose()

  return merged
}
