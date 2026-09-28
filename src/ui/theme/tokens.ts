import { mixHex, softenToward, threeStopRamp } from './color'

/**
 * Huerto's design tokens: the full palette (~10 base colors) shared by the
 * 3D scene and the UI chrome (P1). Everything else in the app derives from
 * these -- no other hex literal should appear outside this module and
 * `color.ts`.
 */

export const palette = {
  barkDark: '#4a3324',
  barkLight: '#7a5738',
  soilRock: '#6b5847',
  grass: '#5c8c4a',
  leafFresh: '#5fa851',
  leafGold: '#d9a441',
  leafRust: '#a8502c',
  fruit: '#ff6a12',
  blossom: '#f3c1d1',
  bud: '#bdeb8f',
  skyTop: '#ffd9a0',
  skyHorizon: '#ff9d6c',
  fog: '#f6c9a0',
} as const

/**
 * M3's bioluminescent-mycelium-on-dark-loam palette (P1), shared by the 3D
 * network scene and any UI chrome that wants to echo it. Kept separate from
 * `palette` above (still used by the not-yet-removed tree code, M4) rather
 * than replacing it in place.
 */
export const mycelium = {
  soilNear: '#05070a',
  soilFar: '#0a0e12',
  hyphaActiveBase: '#4fa8c9',
  hyphaActiveTip: '#6ee7ff',
  hyphaDeadBase: '#5a4a3a',
  hyphaDeadTip: '#8a6b4f',
  hyphaOpen: '#ffe9a8',
  hyphaLiveBranch: '#9fb3c8',
  hyphaConduit: '#2c4a52',
  fusion: '#ffe9a8',
  mushroomCap: '#fff8ec',
  mushroomRim: '#b9f5ff',
  sporeCore: '#eafffa',
  sporeHalo: '#7ff5c4',
  ring: '#4fa8c9',
  selection: '#eafffb',
} as const

export const ui = {
  // Self-hosted via @fontsource (see `main.tsx`) -- falls back to a generic
  // system serif/sans if the font files ever fail to load.
  fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
  fontBody: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  // Near-black loam (P1), matching the mycelium scene's own background --
  // was a warm brown (`#151009`) for the tree metaphor.
  bg: '#05070a',
  panelBg: 'rgba(5, 7, 10, 0.82)',
  panelBorder: 'rgba(110, 231, 255, 0.22)',
  text: '#eafffb',
  textMuted: 'rgba(234, 255, 251, 0.65)',
  accent: mycelium.hyphaActiveTip,
  focusRing: mycelium.hyphaActiveTip,
  space: (steps: number) => `${steps * 4}px`,
} as const

/** Fresh green -> gold -> rust, driven by a leaf/twig element's `age` (0 = fresh, 1 = oldest). */
export function leafColorForAge(age: number): string {
  return threeStopRamp(palette.leafFresh, palette.leafGold, palette.leafRust, age)
}

/**
 * Real per-repository-language GitHub colors, softened toward the earthy
 * soil palette so strata stay cohesive with the rest of the scene instead of
 * clashing with arbitrary linguist brand colors.
 */
export function soilStratumColor(languageColor: string | null): string {
  const source = languageColor ?? palette.soilRock
  return softenToward(source, palette.soilRock, 0.45)
}

/** Bark color varies slightly with normalized height (0 = base, 1 = tip) for a touch of visual richness. */
export function barkColorAt(heightFraction: number): string {
  return mixHex(palette.barkDark, palette.barkLight, Math.min(1, Math.max(0, heightFraction)))
}
