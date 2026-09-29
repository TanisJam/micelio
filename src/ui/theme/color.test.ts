import { describe, expect, it } from 'vitest'
import { hexToRgb, mixHex, rgbToHex } from './color'

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a 6-digit hex color', () => {
    expect(hexToRgb('#3178c6')).toEqual({ r: 0x31, g: 0x78, b: 0xc6 })
    expect(rgbToHex({ r: 0x31, g: 0x78, b: 0xc6 })).toBe('#3178c6')
  })

  it('expands 3-digit hex', () => {
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('falls back to black for malformed input', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('clamps out-of-range channels when converting back', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080')
  })
})

describe('mixHex', () => {
  it('returns the first color at t=0 and the second at t=1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('is the midpoint at t=0.5', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clamps t outside [0, 1]', () => {
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
})
