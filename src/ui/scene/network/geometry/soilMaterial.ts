import * as THREE from 'three'
import { hexToVec3 } from './colors'
import { mycelium } from '../../../theme/tokens'

/**
 * The soil disc's shader (P1/P2): a dark loam gradient with subtle
 * low-frequency noise, a soft vignette falloff at the rim (so the disc reads
 * as a patch, not a hard-edged coin, against the near-black background), and
 * the colony's own faint concentric growth rings (P9's "faint ring = release
 * date") baked in as a fixed-size uniform array rather than separate ring
 * geometry -- one draw call for the whole soil (P12).
 *
 * Deliberately OPAQUE (`transparent: false`, real depth writes), not alpha-
 * blended: an alpha-faded disc is sorted into three.js's transparent render
 * queue, whose back-to-front object order is a coarse bounding-sphere-
 * distance heuristic -- for a huge flat disc sharing almost the same depth
 * as the additively-blended hyphae/hairs sitting just above it, that
 * heuristic can (and did, found via 3D visual review, M3) draw the soil
 * *after* the filaments and overwrite them entirely, since the soil's own
 * alpha is near 1 across its interior. The vignette is done with color
 * (mixing toward the background's own near-black) instead, which reads
 * almost identically here since the scene background is already a similarly
 * dark gradient.
 *
 * M3b visual review found this read as "a flat light-blue plate with a hard
 * edge": the base gradient went soilNear (center) -> soilFar (edge, the
 * LIGHTER of the two loam tokens) and ONLY THEN mixed toward near-black for
 * the vignette starting at 0.82*radius -- so there was a visible lighter
 * ring/band right before the rim, reading as a coin's raised edge, not a
 * soft patch. Fixed to one monotonic darkening from center to rim: the
 * center now starts at the lighter `soilFar` tone (a deliberate "faint cool
 * ambient haze near the core", P1 item 7) and darkens continuously through
 * `soilNear` into the vignette (now starting much earlier, 0.55*radius)
 * down to near-black at the true rim -- no reversal, so no band.
 */

export const MAX_SOIL_RINGS = 48

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    // CircleGeometry lies in the local XY plane; the mesh is rotated -90 deg
    // around X to lie flat, so local (x, y) already maps onto world (x, z).
    vXZ = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying vec2 vXZ;

  uniform vec3 uColorNear;
  uniform vec3 uColorFar;
  uniform vec3 uEdgeColor;
  uniform vec3 uRingColor;
  uniform float uRadius;
  uniform float uRingRadii[${MAX_SOIL_RINGS}];
  uniform int uRingCount;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    float dist = length(vXZ);
    float t = clamp(dist / max(uRadius, 0.001), 0.0, 1.0);
    // One monotonic darkening from a slightly lighter core haze (P1 item 7)
    // out to the loam's own darkest tone -- see the module doc for why this
    // replaced the old near->far gradient (it produced a visible lighter
    // "ring" right before the vignette).
    vec3 base = mix(uColorFar, uColorNear, smoothstep(0.0, 0.65, t));

    // Two noise octaves (P4's "subtle grain"): a low-frequency wash plus a
    // finer, quieter speckle on top, so the loam reads as tactile grain
    // rather than a single smooth band of noise.
    float coarse = valueNoise(vXZ * 1.4) * 0.07 - 0.035;
    float fine = valueNoise(vXZ * 9.0) * 0.03 - 0.015;
    base += vec3(coarse + fine);

    // A hairline ring -- empty by default (see the module doc); populated
    // with exactly ONE ring while a mushroom is selected (M3b item 3), so
    // unlike the old "every release, always on" version this can afford to
    // read clearly rather than only as a barely-there wash once many
    // overlapping rings summed together.
    float ringGlow = 0.0;
    for (int i = 0; i < ${MAX_SOIL_RINGS}; i++) {
      if (i >= uRingCount) break;
      float d = abs(dist - uRingRadii[i]);
      ringGlow += smoothstep(0.022, 0.0, d) * 0.4;
    }
    base += uRingColor * min(ringGlow, 0.4);

    // Vignette: continues the SAME darkening direction (never reverses it)
    // toward the background's own near-black, starting well before the true
    // rim so the falloff is soft and gradual -- no visible hard edge.
    float edge = smoothstep(uRadius * 0.55, uRadius, dist);
    base = mix(base, uEdgeColor, edge);

    gl_FragColor = vec4(base, 1.0);
  }
`

export function createSoilMaterial(radius: number, ringRadii: number[]): THREE.ShaderMaterial {
  const paddedRings = new Float32Array(MAX_SOIL_RINGS)
  for (let i = 0; i < Math.min(ringRadii.length, MAX_SOIL_RINGS); i++) paddedRings[i] = ringRadii[i]!

  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uColorNear: { value: hexToVec3(mycelium.soilNear) },
      uColorFar: { value: hexToVec3(mycelium.soilFar) },
      uEdgeColor: { value: hexToVec3(mycelium.soilNear) },
      uRingColor: { value: hexToVec3(mycelium.ring) },
      uRadius: { value: radius },
      uRingRadii: { value: paddedRings },
      uRingCount: { value: Math.min(ringRadii.length, MAX_SOIL_RINGS) },
    },
    transparent: false,
    depthWrite: true,
  })
}
