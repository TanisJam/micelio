import { describe, expect, it } from 'vitest'
import {
  chooseCameraFraming,
  computeFramingDistance,
  LANDSCAPE_FRAME_MARGIN,
  LANDSCAPE_PITCH_RADIANS,
  PORTRAIT_FRAME_MARGIN,
  PORTRAIT_PITCH_RADIANS,
} from './cameraFraming'

describe('chooseCameraFraming', () => {
  it('picks the landscape pitch/margin for a wide (desktop) aspect ratio', () => {
    expect(chooseCameraFraming(1440 / 900)).toEqual({ pitchRadians: LANDSCAPE_PITCH_RADIANS, frameMargin: LANDSCAPE_FRAME_MARGIN })
  })

  it('picks the portrait pitch/margin for a narrow (mobile) aspect ratio', () => {
    expect(chooseCameraFraming(390 / 844)).toEqual({ pitchRadians: PORTRAIT_PITCH_RADIANS, frameMargin: PORTRAIT_FRAME_MARGIN })
  })

  it('treats a perfectly square viewport as landscape (aspect < 1 is the only portrait trigger)', () => {
    expect(chooseCameraFraming(1)).toEqual({ pitchRadians: LANDSCAPE_PITCH_RADIANS, frameMargin: LANDSCAPE_FRAME_MARGIN })
  })

  it("D2/T8: the portrait pitch is steeper (closer to top-down) than landscape's", () => {
    expect(PORTRAIT_PITCH_RADIANS).toBeGreaterThan(LANDSCAPE_PITCH_RADIANS)
  })

  it('D2/T8: the portrait frame margin is tighter (closer camera) than landscape\'s', () => {
    expect(PORTRAIT_FRAME_MARGIN).toBeLessThan(LANDSCAPE_FRAME_MARGIN)
  })
})

describe('computeFramingDistance', () => {
  const RADIUS = 10
  const VERTICAL_FOV = (42 * Math.PI) / 180

  it('is exact for a square viewport (vertical and horizontal FOV equal)', () => {
    const distance = computeFramingDistance(RADIUS, VERTICAL_FOV, 1, 1)
    expect(distance).toBeCloseTo(RADIUS / Math.sin(VERTICAL_FOV / 2), 5)
  })

  it('scales linearly with frameMargin', () => {
    const base = computeFramingDistance(RADIUS, VERTICAL_FOV, 1, 1)
    const scaled = computeFramingDistance(RADIUS, VERTICAL_FOV, 1, 1.28)
    expect(scaled).toBeCloseTo(base * 1.28, 5)
  })

  it('needs a larger distance for a narrower (portrait) aspect than a wider one, at the same margin', () => {
    const portrait = computeFramingDistance(RADIUS, VERTICAL_FOV, 390 / 844, 1)
    const landscape = computeFramingDistance(RADIUS, VERTICAL_FOV, 1440 / 900, 1)
    expect(portrait).toBeGreaterThan(landscape)
  })

  it('is always non-negative and finite for reasonable inputs', () => {
    const distance = computeFramingDistance(RADIUS, VERTICAL_FOV, 390 / 844, 1.1)
    expect(Number.isFinite(distance)).toBe(true)
    expect(distance).toBeGreaterThan(0)
  })
})
