/**
 * Micelio's design tokens: the bioluminescent-mycelium-on-dark-loam palette
 * (P1) shared by the 3D network scene and the UI chrome -- no other hex
 * literal should appear outside this module and `color.ts`. M4 removed the
 * earlier tree-metaphor palette once the tree code that used it was deleted.
 */
export const mycelium = {
  // Unit 3 ("let the substrate emerge from the mycelium"): the geometric
  // soil disc is gone -- these two tokens now color the density-based haze
  // (`substrateMaterial.ts`) instead, kept dark and low-contrast for the
  // same reason the disc was (M3c item 5): summed across a wide area, even
  // a subtly lighter tone reads as a visible plate/ellipse against the
  // near-black background, so the far tone stays very close to the near one
  // -- only a faint haze near real structure, fading to background beyond it.
  substrateNear: '#05070a',
  substrateFar: '#06080b',
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
