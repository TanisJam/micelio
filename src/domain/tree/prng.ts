/**
 * Deterministic pseudo-random generator, seeded from a string (typically
 * `owner/repo`). Same seed -> same sequence, always -- this is what makes
 * the tree model reproducible for a given repository.
 *
 * No React, no three.js, no fetch, no Math.random.
 */

/** xmur3-style string hash, used to derive a 32-bit seed from a string. */
function hashStringToSeed(input: string): number {
  let hash = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  return (hash ^ (hash >>> 16)) >>> 0
}

export type Prng = () => number

/**
 * Creates a seeded PRNG (mulberry32) yielding floats in [0, 1). Calling the
 * returned function repeatedly advances the sequence deterministically.
 */
export function createPrng(seedString: string): Prng {
  let state = hashStringToSeed(seedString)
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random float in [min, max) using the given PRNG. */
export function randRange(prng: Prng, min: number, max: number): number {
  return min + prng() * (max - min)
}

/** Random float in [-magnitude, magnitude) using the given PRNG. */
export function randJitter(prng: Prng, magnitude: number): number {
  return randRange(prng, -magnitude, magnitude)
}
