/**
 * Small, pure hex-color math shared by the 3D scene and any CSS/UI that
 * needs the same tokens (P1). No React, no three.js.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

/** Parses `#rgb` or `#rrggbb` into 0..255 channel values. Falls back to black on bad input. */
export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized

  const value = Number.parseInt(expanded, 16)
  if (expanded.length !== 6 || Number.isNaN(value)) return { r: 0, g: 0, b: 0 }

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (channel: number) => clampByte(channel).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Linear-interpolates two hex colors at `t` (0..1, clamped). */
export function mixHex(a: string, b: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  return rgbToHex({
    r: rgbA.r + (rgbB.r - rgbA.r) * clamped,
    g: rgbA.g + (rgbB.g - rgbA.g) * clamped,
    b: rgbA.b + (rgbB.b - rgbA.b) * clamped,
  })
}

/** Mixes a source color toward a target "palette" color by `amount` (0..1). Used to soften real GitHub language colors so they stay cohesive with the rest of the scene. */
export function softenToward(source: string, target: string, amount: number): string {
  return mixHex(source, target, amount)
}

/** Three-stop ramp: mixes smoothly between `a`, `b` and `c` as `t` goes 0 -> 0.5 -> 1. */
export function threeStopRamp(a: string, b: string, c: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped < 0.5 ? mixHex(a, b, clamped * 2) : mixHex(b, c, (clamped - 0.5) * 2)
}
