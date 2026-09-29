import { describe, expect, it } from 'vitest'
import { clampWorldRadiusForScreenSize, computeMaxWorldRadiusForPixels } from './screenSizeClamp'

describe('computeMaxWorldRadiusForPixels', () => {
  const VERTICAL_FOV = (42 * Math.PI) / 180
  const HEIGHT_PX = 900

  it('is exact for the perspective-projection formula (round trip)', () => {
    const distance = 10
    const maxPixelRadius = 40
    const maxRadius = computeMaxWorldRadiusForPixels(distance, VERTICAL_FOV, HEIGHT_PX, maxPixelRadius)
    // Projecting that exact world radius back through the same formula
    // should land on (approximately) maxPixelRadius pixels.
    const projectedPx = (maxRadius / (distance * Math.tan(VERTICAL_FOV / 2))) * (HEIGHT_PX / 2)
    expect(projectedPx).toBeCloseTo(maxPixelRadius, 6)
  })

  it('shrinks as the camera gets closer (same on-screen budget, less distance to spend it over)', () => {
    const far = computeMaxWorldRadiusForPixels(20, VERTICAL_FOV, HEIGHT_PX, 40)
    const near = computeMaxWorldRadiusForPixels(2, VERTICAL_FOV, HEIGHT_PX, 40)
    expect(near).toBeLessThan(far)
  })

  it('returns Infinity for a non-positive distance (never collapses to 0)', () => {
    expect(computeMaxWorldRadiusForPixels(0, VERTICAL_FOV, HEIGHT_PX, 40)).toBe(Number.POSITIVE_INFINITY)
    expect(computeMaxWorldRadiusForPixels(-5, VERTICAL_FOV, HEIGHT_PX, 40)).toBe(Number.POSITIVE_INFINITY)
  })

  it('returns Infinity for a non-positive viewport height or FOV', () => {
    expect(computeMaxWorldRadiusForPixels(10, VERTICAL_FOV, 0, 40)).toBe(Number.POSITIVE_INFINITY)
    expect(computeMaxWorldRadiusForPixels(10, 0, HEIGHT_PX, 40)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('clampWorldRadiusForScreenSize', () => {
  const VERTICAL_FOV = (42 * Math.PI) / 180
  const HEIGHT_PX = 900

  it('leaves a radius unchanged when it already projects under the pixel cap', () => {
    const desired = 0.05
    const clamped = clampWorldRadiusForScreenSize(desired, 20, VERTICAL_FOV, HEIGHT_PX, 40)
    expect(clamped).toBe(desired)
  })

  it('shrinks a radius that would project past the pixel cap at close range', () => {
    const desired = 0.5
    const clamped = clampWorldRadiusForScreenSize(desired, 0.6, VERTICAL_FOV, HEIGHT_PX, 40)
    expect(clamped).toBeLessThan(desired)
    expect(clamped).toBeGreaterThan(0)
  })

  it('never grows a radius past what was asked for', () => {
    const desired = 0.02
    const clamped = clampWorldRadiusForScreenSize(desired, 0.01, VERTICAL_FOV, HEIGHT_PX, 400)
    expect(clamped).toBeLessThanOrEqual(desired)
  })
})
