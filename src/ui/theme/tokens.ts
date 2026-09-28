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

export const ui = {
  fontDisplay: "Georgia, 'Times New Roman', serif",
  fontBody:
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  bg: '#151009',
  panelBg: 'rgba(21, 16, 9, 0.82)',
  panelBorder: 'rgba(255, 217, 160, 0.22)',
  text: '#fbf3e7',
  textMuted: 'rgba(251, 243, 231, 0.65)',
  accent: palette.leafGold,
  focusRing: '#ffd9a0',
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
