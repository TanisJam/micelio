import * as THREE from 'three'

/**
 * A simple vertical-gradient texture (top -> horizon), used as the scene
 * background. Deliberately a screen-space backdrop rather than a 3D sky
 * dome: three.js renders a flat `Texture` background stretched to fill the
 * viewport regardless of camera orientation, which reads as a consistent
 * warm sky gradient (P2) no matter how the auto-framed camera is angled --
 * a world-anchored sky sphere would only show a visible gradient band when
 * the camera happened to look near the zenith.
 */
export function buildSkyTexture(topColor: string, horizonColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for sky texture')

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, topColor)
  gradient.addColorStop(1, horizonColor)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
