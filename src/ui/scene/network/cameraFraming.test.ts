import { describe, expect, it } from 'vitest'
import valtioFixture from '../../../server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import { buildNetwork } from '../../../domain/network'
import type { RepoSnapshot } from '../../../domain/repo'
import { makeSnapshot } from '../../../domain/shared/testHelpers'
import {
  chooseCameraFraming,
  clampReplayGrownRadius,
  computeFramingDistance,
  computeGrownRadius,
  LANDSCAPE_FRAME_MARGIN,
  LANDSCAPE_PITCH_RADIANS,
  PORTRAIT_FRAME_MARGIN,
  PORTRAIT_PITCH_RADIANS,
  REPLAY_MIN_GROWN_RADIUS_FLOOR,
  REPLAY_MIN_GROWN_RADIUS_FRACTION,
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

describe('computeGrownRadius', () => {
  const valtioModel = buildNetwork(valtioFixture as unknown as RepoSnapshot)

  it('post-final-pass (framing): matches the model\'s own final bounding radius at the last event time', () => {
    const grown = computeGrownRadius(valtioModel, valtioModel.bounds.time.lastEventTime)
    // `bounds.radius` (buildNetwork.ts) also considers growth-ring markers,
    // which computeGrownRadius deliberately does not (they're an internal
    // layout aid, never rendered) -- so this is a close, not exact, match.
    expect(grown).toBeGreaterThan(valtioModel.bounds.radius * 0.9)
    expect(grown).toBeLessThanOrEqual(valtioModel.bounds.radius + 1e-6)
  })

  it('grows strictly from the first event time to the last -- the colony grows outward over its replay', () => {
    const start = computeGrownRadius(valtioModel, valtioModel.bounds.time.firstEventTime)
    const end = computeGrownRadius(valtioModel, valtioModel.bounds.time.lastEventTime)
    expect(start).toBeLessThan(end)
  })

  it('is monotonically non-decreasing as time advances (the colony only ever grows outward)', () => {
    const { firstEventTime, lastEventTime } = valtioModel.bounds.time
    const span = lastEventTime - firstEventTime
    let previous = 0
    for (let step = 0; step <= 10; step++) {
      const time = firstEventTime + (span * step) / 10
      const radius = computeGrownRadius(valtioModel, time)
      expect(radius).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = radius
    }
  })

  it('returns 0 for a model with no grown structure at all (well before anything starts)', () => {
    const snapshot = makeSnapshot({
      mergedPullRequests: [],
      openPullRequests: [],
      closedPullRequests: [],
      liveBranches: [],
      releases: [],
      directCommits: [],
    })
    const model = buildNetwork(snapshot)
    expect(computeGrownRadius(model, model.bounds.time.firstEventTime - 1_000_000)).toBe(0)
  })
})

describe('clampReplayGrownRadius', () => {
  it('never lets the effective radius fall below the fraction of the final radius (task B: never zoom closer than ~40% of the final extent)', () => {
    const finalRadius = 10
    const clamped = clampReplayGrownRadius(0, finalRadius)
    expect(clamped).toBeCloseTo(finalRadius * REPLAY_MIN_GROWN_RADIUS_FRACTION, 6)
  })

  it('leaves a grown radius unchanged once it has genuinely grown past the floor', () => {
    const finalRadius = 10
    const grown = 8
    expect(clampReplayGrownRadius(grown, finalRadius)).toBe(grown)
  })

  it('falls back to the absolute floor for a near-degenerate (tiny) final radius', () => {
    const clamped = clampReplayGrownRadius(0, 0.01)
    expect(clamped).toBe(REPLAY_MIN_GROWN_RADIUS_FLOOR)
  })

  it('is monotonically non-decreasing in the grown radius', () => {
    const finalRadius = 6
    const small = clampReplayGrownRadius(1, finalRadius)
    const large = clampReplayGrownRadius(5, finalRadius)
    expect(large).toBeGreaterThanOrEqual(small)
  })
})
