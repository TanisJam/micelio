import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Small shared low-poly geometries for scattered elements (leaves, fruit,
 * flowers, buds). Module-level singletons: identical shape regardless of
 * repository, reused across the app's lifetime, no per-model disposal
 * needed.
 */

interface ClusterPart {
  radius: number
  position: [number, number, number]
  scale: [number, number, number]
  rotation: [number, number, number]
}

/** Merges a handful of small offset/rotated icosahedra into one geometry, reused for every instance -- gives a leaf a sense of clustered volume instead of a single flat card ("stack of discs" look). */
function buildClusterGeometry(parts: ClusterPart[]): THREE.BufferGeometry {
  const pieces = parts.map((part) => {
    const geometry = new THREE.IcosahedronGeometry(part.radius, 0)
    geometry.scale(part.scale[0], part.scale[1], part.scale[2])
    geometry.rotateX(part.rotation[0])
    geometry.rotateY(part.rotation[1])
    geometry.rotateZ(part.rotation[2])
    geometry.translate(part.position[0], part.position[1], part.position[2])
    geometry.computeVertexNormals()
    return geometry
  })
  const merged = mergeGeometries(pieces, false)
  for (const piece of pieces) piece.dispose()
  if (!merged) throw new Error('Failed to merge cluster geometry')
  return merged
}

export const leafGeometry = buildClusterGeometry([
  { radius: 0.11, position: [0, 0, 0], scale: [1, 0.55, 1.35], rotation: [0.15, 0.3, 0] },
  { radius: 0.085, position: [0.07, 0.03, 0.05], scale: [0.85, 0.5, 1.1], rotation: [-0.2, -0.7, 0.25] },
  { radius: 0.08, position: [-0.06, -0.02, -0.05], scale: [0.8, 0.5, 1.0], rotation: [0.3, 1.1, -0.2] },
])

export const fruitGeometry = new THREE.IcosahedronGeometry(0.115, 0)

export const flowerGeometry = (() => {
  const geometry = new THREE.IcosahedronGeometry(0.1, 0)
  geometry.scale(1, 0.6, 1)
  return geometry
})()

export const budGeometry = new THREE.IcosahedronGeometry(0.06, 0)
