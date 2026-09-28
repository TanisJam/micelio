import * as THREE from 'three'

/**
 * Small shared low-poly geometries for scattered elements (leaves, fruit,
 * flowers, buds). Module-level singletons: identical shape regardless of
 * repository, reused across the app's lifetime, no per-model disposal
 * needed.
 */

export const leafGeometry = (() => {
  const geometry = new THREE.IcosahedronGeometry(0.13, 0)
  geometry.scale(1, 0.35, 1.5)
  return geometry
})()

export const fruitGeometry = new THREE.IcosahedronGeometry(0.11, 0)

export const flowerGeometry = (() => {
  const geometry = new THREE.IcosahedronGeometry(0.1, 0)
  geometry.scale(1, 0.6, 1)
  return geometry
})()

export const budGeometry = new THREE.IcosahedronGeometry(0.055, 0)
