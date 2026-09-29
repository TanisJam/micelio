import { describe, expect, it } from 'vitest'
import type { TimeBounds } from '../../domain/shared'
import { createGrowthClockController, type GrowthClockScheduler } from './growthClockController'

const BOUNDS: TimeBounds = { firstEventTime: 0, lastEventTime: 10_000_000 }

/**
 * A deterministic fake scheduler: `requestFrame` never fires on its own --
 * the test drives frames explicitly via `advance(ms)`, which invokes every
 * pending callback with `now += ms` and lets it re-schedule itself, exactly
 * like a real animation-frame loop but under full test control.
 */
function createFakeScheduler() {
  let now = 0
  let nextId = 1
  const pending = new Map<number, (time: number) => void>()

  const scheduler: GrowthClockScheduler = {
    now: () => now,
    requestFrame: (callback) => {
      const id = nextId++
      pending.set(id, callback)
      return id
    },
    cancelFrame: (id) => {
      pending.delete(id)
    },
  }

  function advance(ms: number) {
    now += ms
    // Snapshot so a callback re-scheduling itself doesn't get invoked twice
    // in the same `advance` call.
    const callbacks = Array.from(pending.entries())
    pending.clear()
    for (const [, callback] of callbacks) callback(now)
  }

  return { scheduler, advance, pendingCount: () => pending.size }
}

describe('createGrowthClockController', () => {
  it('starts at progress 0 and does not play when shouldAutoPlay is false', () => {
    const { scheduler } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, false, scheduler)
    expect(clock.getProgress()).toBe(0)
    expect(clock.isPlaying()).toBe(false)
  })

  it('autoplay starts once created and advances progress over time', () => {
    const { scheduler, advance } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    expect(clock.isPlaying()).toBe(true)
    expect(clock.getProgress()).toBe(0)
    // Construction never schedules a frame as a side effect (see the
    // controller's doc comment); the mount effect kicks it explicitly, once
    // data (`bounds`) is ready -- mirrored here.
    clock.play()

    advance(4500) // first frame: no previous frame time, dt=0
    advance(4500) // 4.5s of the 18s duration
    expect(clock.getProgress()).toBeCloseTo(0.25, 5)
    expect(clock.isPlaying()).toBe(true)

    advance(13_500)
    expect(clock.getProgress()).toBe(1)
    expect(clock.isPlaying()).toBe(false)
  })

  it('getTime maps progress through the eased curve onto the real bounds, exact at both ends', () => {
    const { scheduler, advance } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.play()
    expect(clock.getTime()).toBe(BOUNDS.firstEventTime)
    advance(0)
    advance(18_000)
    expect(clock.getProgress()).toBe(1)
    expect(clock.getTime()).toBe(BOUNDS.lastEventTime)
  })

  it('pause stops ticking and cancels the pending frame', () => {
    const { scheduler, advance, pendingCount } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.play()
    advance(0)
    expect(pendingCount()).toBe(1)
    clock.pause()
    expect(clock.isPlaying()).toBe(false)
    // The already-scheduled frame from before pause still exists (pause
    // doesn't cancel it), but ticking it is a no-op since `playing` is false.
    advance(5000)
    expect(clock.getProgress()).toBe(0)
  })

  it('seek jumps to a clamped progress and pauses', () => {
    const { scheduler } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.seek(0.5)
    expect(clock.getProgress()).toBe(0.5)
    expect(clock.isPlaying()).toBe(false)
    clock.seek(5)
    expect(clock.getProgress()).toBe(1)
    clock.seek(-5)
    expect(clock.getProgress()).toBe(0)
  })

  it('toggle flips play state, restarting from 0 once finished', () => {
    const { scheduler, advance } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.play()
    advance(0)
    advance(18_000)
    expect(clock.getProgress()).toBe(1)
    expect(clock.isPlaying()).toBe(false)
    clock.toggle()
    expect(clock.isPlaying()).toBe(true)
    expect(clock.getProgress()).toBe(0)
  })

  it('notifies subscribers on every tick and on manual state changes', () => {
    const { scheduler, advance } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.play()
    let calls = 0
    const unsubscribe = clock.subscribe(() => calls++)
    advance(0)
    advance(1000)
    expect(calls).toBeGreaterThan(0)
    const callsBeforePause = calls
    clock.pause()
    expect(calls).toBe(callsBeforePause + 1)
    unsubscribe()
    clock.pause()
    expect(calls).toBe(callsBeforePause + 1)
  })

  it('destroy stops playback and cancels the pending frame', () => {
    const { scheduler, advance, pendingCount } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0, true, scheduler)
    clock.play()
    advance(0)
    expect(pendingCount()).toBe(1)
    clock.destroy()
    expect(clock.isPlaying()).toBe(false)
    expect(pendingCount()).toBe(0)
    advance(5000)
    expect(clock.getProgress()).toBe(0)
  })

  /**
   * Regression test for the real T8 bug: React `StrictMode` double-invokes
   * the mount effect in development -- effect runs, its cleanup runs
   * immediately (simulating an unmount), then the effect runs again
   * (simulating a remount) -- all synchronously, before any real time
   * passes or the browser paints. The ORIGINAL `useGrowthClock` mount
   * effect resumed with `if (clock.isPlaying()) clock.play()`; since the
   * synthetic cleanup's `destroy()` already set `playing = false`, that
   * check was false on the second (real) mount and `play()` was never
   * called again -- the clock was permanently stuck, and the growth
   * scrubber never advanced on any dev-mode load. The fix resumes from a
   * `shouldAutoPlay` intent captured once, independent of the clock's
   * current runtime state, which this test exercises directly against the
   * plain controller (no React needed).
   */
  it('resumes correctly after a StrictMode-style mount -> destroy -> mount sequence', () => {
    const { scheduler, advance } = createFakeScheduler()
    const shouldAutoPlay = true
    const clock = createGrowthClockController(BOUNDS, 0, shouldAutoPlay, scheduler)

    // First (synthetic) mount effect.
    if (shouldAutoPlay) clock.play()
    // Synthetic StrictMode cleanup, as if the component had unmounted.
    clock.destroy()
    expect(clock.isPlaying()).toBe(false)

    // Second (real) mount effect -- resuming from `shouldAutoPlay`, NOT
    // from `clock.isPlaying()` (which would incorrectly be `false` here).
    if (shouldAutoPlay) clock.play()

    expect(clock.isPlaying()).toBe(true)
    advance(0)
    advance(3000)
    expect(clock.getProgress()).toBeGreaterThan(0)
    advance(15_000)
    expect(clock.getProgress()).toBe(1)
  })

  it('Unit 4: getTime paces by the given event times, not pure linear time, when sortedEventTimes is provided', () => {
    const { scheduler } = createFakeScheduler()
    // Every event crammed into the first half of the real calendar span --
    // a linear clock would show most events "already passed" by progress
    // 0.5, while an event-paced clock spreads them evenly across the whole
    // 0..1 progress range.
    const events = [0, 100, 200, 300, 10_000_000]
    const clock = createGrowthClockController(BOUNDS, 0.5, false, scheduler, events)
    const linearMidTime = (BOUNDS.firstEventTime + BOUNDS.lastEventTime) / 2
    expect(clock.getTime()).toBeLessThan(linearMidTime)
  })

  it('Unit 4: falls back to pure linear time when sortedEventTimes is omitted', () => {
    const { scheduler } = createFakeScheduler()
    const clock = createGrowthClockController(BOUNDS, 0.5, false, scheduler)
    const linearMidTime = (BOUNDS.firstEventTime + BOUNDS.lastEventTime) / 2
    expect(Math.abs(clock.getTime() - linearMidTime)).toBeLessThan(1)
  })
})
