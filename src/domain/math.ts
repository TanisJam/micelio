/**
 * Small pure math helpers shared by the domain layer (e.g. the tree model).
 * No React, no three.js, no fetch — this module must stay side-effect free.
 */

/** Clamps `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp: min (${min}) must be <= max (${max})`)
  }
  return Math.min(Math.max(value, min), max)
}

/** Linear interpolation between `a` and `b` at position `t` (not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Log-scaled normalization of `value` within [min, max] into [0, 1].
 * Useful for compressing wide-ranging counts (age, activity) into a
 * perceptually reasonable range. Falls back to linear behavior when
 * min <= 0.
 */
export function logScale(value: number, min: number, max: number): number {
  if (max <= min) return 0
  const safeMin = Math.max(min, 0)
  const safeValue = Math.max(value, safeMin)
  if (safeMin <= 0) {
    // Shift into strictly positive domain to keep log() defined.
    const shift = 1 - safeMin
    return clamp(
      Math.log(safeValue + shift) / Math.log(max + shift),
      0,
      1,
    )
  }
  return clamp(
    (Math.log(safeValue) - Math.log(safeMin)) / (Math.log(max) - Math.log(safeMin)),
    0,
    1,
  )
}

/** Cubic ease-out: fast start, gentle stop. `t` is clamped to [0, 1]. */
export function easeOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1)
  return 1 - (1 - clamped) ** 3
}

/** Cubic ease-in-out: gentle start and stop. `t` is clamped to [0, 1]. */
export function easeInOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1)
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}
