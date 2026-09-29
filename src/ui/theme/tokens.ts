/**
 * Micelio's design tokens: the bioluminescent-mycelium-on-dark-loam palette
 * (P1) shared by the 3D network scene and the UI chrome -- no other hex
 * literal should appear outside this module and `color.ts`. M4 removed the
 * earlier tree-metaphor palette once the tree code that used it was deleted.
 */
export const mycelium = {
  // Round-3 orchestrator finding: the earlier density-texture substrate haze
  // (which used to color a rasterized field with this token and a sibling
  // `substrateNear`) read as a blocky, pixelated disc with hard-edged holes
  // on real repos -- removed entirely (see `NetworkSceneContent.tsx`'s
  // module doc). `substrateFar` survives as just the scene's flat background
  // tone (`Scene.tsx`'s `scene.background`, this ground's `hemisphereLight`
  // tint) -- no longer "far from any real structure" in a density field that
  // no longer exists.
  substrateFar: '#05070a',
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
