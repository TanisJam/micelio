import * as THREE from 'three'
import { mycelium } from '../../../theme/tokens'

/**
 * Unlike `hexToVec3` (raw sRGB-encoded bytes / 255, used by the additively-
 * blended hypha/glow materials, where the mismatch is imperceptible), this
 * material does an EXACT color match against `Scene.tsx`'s
 * `scene.background` (a `THREE.Color`, which three.js's `ColorManagement`
 * decodes from sRGB into its LINEAR working space) to make a zero-density
 * texel invisible. Feeding a raw sRGB-encoded value into a plain, unlit
 * `ShaderMaterial`'s `gl_FragColor` skips that same decode, so it read as
 * visibly LIGHTER than the true background everywhere -- the entire disc,
 * regardless of the real density field underneath (confirmed by forcing
 * `density = 0.0` unconditionally in the fragment shader during
 * development: the mismatch persisted identically). `convertSRGBToLinear`
 * matches what `scene.background` already does internally.
 */
function hexToLinearVec3(hex: string): THREE.Vector3 {
  const color = new THREE.Color(hex).convertSRGBToLinear()
  return new THREE.Vector3(color.r, color.g, color.b)
}

/**
 * Unit 3 ("let the substrate emerge from the mycelium"): replaces the
 * geometric soil disc/plate (`soilMaterial.ts`, removed) with a shader that
 * samples the colony's OWN density field (`densityField.ts`, packed into a
 * texture by `densityTexture.ts`) instead of a fixed radial gradient -- so
 * the visible silhouette is exactly as organic/irregular as the real hypha
 * distribution, fading to pure background wherever there's no real
 * structure nearby, rather than an ellipse.
 *
 * Kept OPAQUE (`transparent: false`, real depth writes), same reasoning the
 * old soil disc used: an alpha-blended plane sharing almost the same depth
 * as the additively-blended hyphae/hairs sitting just above it can be
 * sorted (three.js's coarse bounding-sphere-distance heuristic for the
 * transparent queue) AFTER them and overwrite them entirely. Instead, both
 * "no structure nearby" (density -> 0) and the true geometric rim fade
 * toward the SAME flat background color (`uEdgeColor`, matched exactly by
 * `Scene.tsx`'s `scene.background`), so the mesh reads as an organic haze
 * with no visible edge, without ever being transparent.
 *
 * Growth reveal: each texel's own recorded birth time (the earliest growth
 * time of anything that contributed density there) is compared against a
 * per-frame `uCurrentTimeNorm` uniform, ramped over `uRevealWindowNorm` --
 * the haze visibly grows outward alongside the hyphae during playback
 * instead of being a static backdrop present from the very first frame.
 *
 * Both are pre-NORMALIZED into `[0, 1]` on the CPU side (`SubstrateHaze.tsx`,
 * full double-precision JS math) before ever reaching the shader, rather
 * than passing raw epoch-millisecond uniforms (~1.7e12) into a `mediump`
 * fragment shader and subtracting them there: `mediump`'s reduced mantissa
 * (real on the headless SwiftShader software renderer this project's own
 * screenshot tooling uses) can't resolve a small `uRevealWindowMs`-sized
 * difference between two numbers of that magnitude reliably.
 * `growthMaterial.ts`'s hypha reveal gets away with raw epoch-ms uniforms
 * because it only ever does an ORDER comparison (`>`), which reduced-
 * precision rounding still preserves; a fine subtraction against a small
 * window does not. (The real, dominant bug found while building this
 * turned out to be a SEPARATE color-space issue -- see `hexToLinearVec3`'s
 * own doc comment -- but this precision fix is real and worth keeping
 * regardless.)
 */

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    // CircleGeometry lies in the local XY plane; the mesh is rotated -90 deg
    // around X to lie flat, so local (x, y) already maps onto world (x, z).
    vXZ = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const MAX_SUBSTRATE_RINGS = 48

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying vec2 vXZ;

  uniform sampler2D uDensityTex;
  uniform vec3 uColorNear;
  uniform vec3 uColorFar;
  uniform vec3 uEdgeColor;
  uniform vec3 uRingColor;
  uniform float uRadius;
  uniform float uCurrentTimeNorm;
  uniform float uRevealWindowNorm;
  uniform float uRingRadii[${MAX_SUBSTRATE_RINGS}];
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
    vec2 uv = vXZ / (2.0 * max(uRadius, 0.001)) + 0.5;
    float density = 0.0;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      vec4 texSample = texture2D(uDensityTex, uv);
      float rawDensity = texSample.r;
      float birthTimeNorm = texSample.g;
      float grown = clamp((uCurrentTimeNorm - birthTimeNorm) / max(uRevealWindowNorm, 0.0001), 0.0, 1.0);
      density = rawDensity * smoothstep(0.0, 1.0, grown);
    }

    // Gentle low-frequency + fine noise (P4's "subtle grain"), only visible
    // where there's already some haze -- keeps the pure-background areas
    // perfectly clean/flat rather than grainy everywhere.
    float coarse = valueNoise(vXZ * 1.4) * 0.06 - 0.03;
    float fine = valueNoise(vXZ * 9.0) * 0.025 - 0.0125;
    float noisyDensity = clamp(density + (coarse + fine) * density, 0.0, 1.0);

    vec3 base = mix(uColorFar, uColorNear, smoothstep(0.0, 1.0, noisyDensity));

    // A hairline ring -- empty by default; populated with exactly ONE ring
    // while a mushroom is selected (same mechanism the old soil disc used).
    float ringGlow = 0.0;
    float dist = length(vXZ);
    for (int i = 0; i < ${MAX_SUBSTRATE_RINGS}; i++) {
      if (i >= uRingCount) break;
      float d = abs(dist - uRingRadii[i]);
      ringGlow += smoothstep(0.022, 0.0, d) * 0.4;
    }
    base += uRingColor * min(ringGlow, 0.4);

    // A guaranteed soft fade through the mesh's OUTER band, independent of
    // the density texture's own content -- real structure (hair tips
    // especially) can sit close to uRadius even with densityField.ts's
    // wide margin, so this backstop is what keeps the true geometric rim
    // itself from ever being visible as a hard edge, no matter how dense
    // the sampled data happens to be right up to it.
    float radialFade = 1.0 - smoothstep(uRadius * 0.55, uRadius, dist);

    // No structure nearby (density ~0, no ring) -> exactly the flat
    // background tone, so neither "no haze" areas nor the mesh's own true
    // geometric rim are visible against the scene's own background.
    float presence = clamp(noisyDensity + ringGlow, 0.0, 1.0) * radialFade;
    base = mix(uEdgeColor, base, presence);

    gl_FragColor = vec4(base, 1.0);
  }
`

export interface SubstrateMaterialUniforms {
  uDensityTex: { value: THREE.Texture }
  uColorNear: { value: THREE.Vector3 }
  uColorFar: { value: THREE.Vector3 }
  uEdgeColor: { value: THREE.Vector3 }
  uRingColor: { value: THREE.Vector3 }
  uRadius: { value: number }
  /** Current growth-replay time normalized into `[0, 1]` over `[timeMin, timeMax]` -- see the module doc for why this is pre-normalized on the CPU rather than a raw epoch-ms uniform. Updated every frame by `SubstrateHaze.tsx`. */
  uCurrentTimeNorm: { value: number }
  /** `SUBSTRATE_REVEAL_WINDOW_MS` expressed as a fraction of the model's own `[timeMin, timeMax]` span -- fixed at creation time (the span never changes for a mounted model). */
  uRevealWindowNorm: { value: number }
  uRingRadii: { value: Float32Array }
  uRingCount: { value: number }
  [key: string]: THREE.IUniform
}

export type SubstrateMaterial = THREE.ShaderMaterial & { uniforms: SubstrateMaterialUniforms }

/** Milliseconds a texel's haze takes to fade fully in after its earliest contributing growth time -- soft, not a hard pop, but short enough to visibly trail the growth front rather than lagging noticeably behind it. */
export const SUBSTRATE_REVEAL_WINDOW_MS = 1200

export function createSubstrateMaterial(params: {
  texture: THREE.Texture
  radius: number
  timeMin: number
  timeMax: number
}): SubstrateMaterial {
  const paddedRings = new Float32Array(MAX_SUBSTRATE_RINGS)
  const span = Math.max(params.timeMax - params.timeMin, 1)

  const uniforms: SubstrateMaterialUniforms = {
    uDensityTex: { value: params.texture },
    uColorNear: { value: hexToLinearVec3(mycelium.substrateNear) },
    uColorFar: { value: hexToLinearVec3(mycelium.substrateFar) },
    uEdgeColor: { value: hexToLinearVec3(mycelium.substrateNear) },
    uRingColor: { value: hexToLinearVec3(mycelium.ring) },
    uRadius: { value: params.radius },
    uCurrentTimeNorm: { value: 0 },
    uRevealWindowNorm: { value: SUBSTRATE_REVEAL_WINDOW_MS / span },
    uRingRadii: { value: paddedRings },
    uRingCount: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    transparent: false,
    depthWrite: true,
    // Matches every other exact-color-match material in this scene
    // (`SporeMesh`, `PointGlowInstances`, `GrowthFrontInstances`) -- the
    // REAL fix for the "always fully visible regardless of density" bug
    // this module's own doc comment describes turned out to be
    // `hexToLinearVec3` (the color-space mismatch), not this flag. Kept
    // anyway since every sibling material in this scene sets it for the
    // same reason (this shader is fully custom GLSL, not one of three.js's
    // built-in tonemapped materials, so it's a no-op either way here, but a
    // harmless, consistent no-op is better than a silently-different one).
    toneMapped: false,
  })

  return material as SubstrateMaterial
}
