import * as THREE from 'three'

/**
 * The one shared shader driving every merged filament mesh (hyphae ribbon,
 * hairs+bridges): growth reveal (T5), hover/select highlight (P7) and the
 * slow outward flow pulse (P4) -- all per-vertex/per-fragment, so growing,
 * hovering or selecting never rebuilds geometry, just updates a few
 * uniforms once per frame.
 *
 * Dimming a non-selected element is done via ALPHA, never an RGB multiply
 * (a real bug found during the tree's V2 pass, see `odd/tasks/huerto-mvp.md`:
 * ACES filmic tonemapping's shadow toe compressed a wide range of per-
 * instance color multipliers into nearly the same too-dark output).
 * Highlighting is additive brightening, which also pushes the element above
 * the bloom luminance threshold.
 */

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 color;
  attribute float alpha;
  attribute float birthTime;
  attribute float hyphaIndex;
  attribute float progress;
  attribute float flowFactor;
  attribute float crossU;
  attribute float brightness;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBirthTime;
  varying float vHyphaIndex;
  varying float vProgress;
  varying float vFlowFactor;
  varying float vCrossU;
  varying float vBrightness;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vBirthTime = birthTime;
    vHyphaIndex = hyphaIndex;
    vProgress = progress;
    vFlowFactor = flowFactor;
    vCrossU = crossU;
    vBrightness = brightness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBirthTime;
  varying float vHyphaIndex;
  varying float vProgress;
  varying float vFlowFactor;
  varying float vCrossU;
  varying float vBrightness;

  uniform float uCurrentTime;
  uniform float uSelectedIndex;
  uniform float uHoveredIndex;
  uniform float uTime;
  uniform float uFlowEnabled;

  void main() {
    if (vBirthTime > uCurrentTime) discard;

    float isSelected = (uSelectedIndex >= 0.0 && abs(vHyphaIndex - uSelectedIndex) < 0.5) ? 1.0 : 0.0;
    float isHovered = (uHoveredIndex >= 0.0 && abs(vHyphaIndex - uHoveredIndex) < 0.5) ? 1.0 : 0.0;
    float dimOthers = (uSelectedIndex >= 0.0 && isSelected < 0.5) ? 1.0 : 0.0;

    // Cross-ribbon glow profile (P3 "fine luminous threads, not painted
    // ribbons"): a bright gaussian-ish core narrowing well inside the
    // ribbon's own geometric width, softly fading to exactly 0 alpha at the
    // edges -- so the mesh is wide enough to glow (bloom has something to
    // catch) but reads as a thin thread, never a flat-shaded brush stroke.
    // crossU is -1..1 across the ribbon width (0 for non-ribbon geometry,
    // e.g. hairs/bridges, which fall through with core=edgeFade=1, unchanged).
    // The SELECTED hypha gets a deliberately wider core (P7: "clearly the
    // brightest thing") -- at full-disc zoom a merely-brighter-but-equally-
    // thin thread is too easy to lose among hundreds of similar strands, so
    // selection also reads as a visibly thicker glowing line, not just a
    // tinted one.
    float u = clamp(vCrossU, -1.0, 1.0);
    float coreWidth = mix(6.5, 2.2, isSelected);
    float core = exp(-coreWidth * u * u);
    float edgeFade = 1.0 - smoothstep(0.82, 1.0, abs(u));
    float widthProfile = core * edgeFade;

    // M3c item 2: raised from mix(0.65, 1.35, core) -- brighter filament
    // cores (restoring luminosity toward the pre-M3b galaxy), while the
    // dimmer 0.8 floor (was 0.65) still keeps a thread's own soft edges from
    // reading as flat-bright all the way across.
    vec3 outColor = vColor * vBrightness * mix(0.8, 1.55, core);
    float outAlpha = vAlpha * widthProfile * mix(1.0, 0.3, dimOthers);
    // A selected hypha never fades away entirely even near its own ribbon
    // edge -- keeps the "clearly the brightest thing" read solid rather than
    // letting the gaussian falloff thin it back out.
    outAlpha = max(outAlpha, isSelected * vAlpha * 0.85);

    outColor += vec3(0.85) * isSelected;
    outColor += vec3(0.22) * isHovered * (1.0 - isSelected);

    float phase = fract(vProgress * 2.2 - uTime * 0.12);
    float pulse = uFlowEnabled * vFlowFactor * smoothstep(0.82, 1.0, phase) * 0.4;
    outColor += vec3(pulse);

    gl_FragColor = vec4(outColor, outAlpha);
  }
`

export interface GrowthMaterialUniforms {
  uCurrentTime: { value: number }
  uSelectedIndex: { value: number }
  uHoveredIndex: { value: number }
  uTime: { value: number }
  uFlowEnabled: { value: number }
  [key: string]: THREE.IUniform
}

export type GrowthMaterial = THREE.ShaderMaterial & { uniforms: GrowthMaterialUniforms }

export function createGrowthMaterial(): GrowthMaterial {
  const uniforms: GrowthMaterialUniforms = {
    uCurrentTime: { value: 0 },
    uSelectedIndex: { value: -1 },
    uHoveredIndex: { value: -1 },
    uTime: { value: 0 },
    uFlowEnabled: { value: 1 },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

  return material as GrowthMaterial
}
