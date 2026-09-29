/**
 * Metaphor-agnostic pure primitives shared across domain layouts (currently
 * just the mycelium network, `../network/`). Moved out of `../tree/` in M4,
 * once the tree metaphor's own geometry code was deleted -- these five
 * pieces (vectors, seeded PRNG, time bounds, playback easing, and the
 * synthetic-snapshot test builders) had no tree-specific content at all.
 */
export { createPrng, randRange, randJitter, type Prng } from './prng'
export * from './types'
export * from './vector'
export { computeTimeBounds } from './timeBounds'
export { easePlaybackProgress, mapPlaybackProgressToTime } from './playback'
