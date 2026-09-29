import * as THREE from 'three'
import type { DensityField } from '../../../../domain/network'

/**
 * Packs a pure `DensityField` (domain, no three.js) into a small
 * `THREE.DataTexture` for `substrateMaterial.ts` to sample: R = density
 * (0..255), G = birth time normalized into `[timeMin, timeMax]` (0..255,
 * clamped to 255/"never" where the field recorded `Infinity`). B/A unused.
 * Static (built once per model change, like every other geometry here) --
 * never re-created per frame; growth reveal happens in the shader by
 * comparing the decoded birth time against a per-frame `uCurrentTime`
 * uniform, not by rebuilding this texture.
 */
export interface DensityTextureResult {
  texture: THREE.DataTexture
  timeMin: number
  timeMax: number
}

export function buildDensityTexture(field: DensityField, timeMin: number, timeMax: number): DensityTextureResult {
  const { resolution } = field
  const span = Math.max(timeMax - timeMin, 1)
  const data = new Uint8Array(resolution * resolution * 4)

  for (let i = 0; i < resolution * resolution; i++) {
    const density = Math.min(1, Math.max(0, field.density[i]!))
    const birth = field.birthTime[i]!
    const normalizedBirth = Number.isFinite(birth) ? Math.min(1, Math.max(0, (birth - timeMin) / span)) : 1
    const base = i * 4
    data[base] = Math.round(density * 255)
    data[base + 1] = Math.round(normalizedBirth * 255)
    data[base + 2] = 0
    data[base + 3] = 255
  }

  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.needsUpdate = true
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  // The field's row 0 is z = -radius (see `buildDensityField`'s `splat`);
  // `DataTexture` rows are also bottom-to-top in the SAME convention three.js
  // uses for `flipY: false`, so this stays in exact correspondence with the
  // shader's own UV -> world mapping (`substrateMaterial.ts`) without a flip.
  texture.flipY = false

  return { texture, timeMin, timeMax }
}
