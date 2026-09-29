import { describe, expect, it } from 'vitest'
import { captionForProgress, shouldShowCaption } from './growthCaptionLogic'

describe('captionForProgress', () => {
  it('shows the "each filament" caption early in the replay', () => {
    expect(captionForProgress(0)).toMatch(/Each filament is a pull request/)
    expect(captionForProgress(0.49)).toMatch(/Each filament is a pull request/)
  })

  it('switches to the "mushrooms" caption for the rest of the replay', () => {
    expect(captionForProgress(0.5)).toMatch(/Mushrooms are releases/)
    expect(captionForProgress(0.99)).toMatch(/Mushrooms are releases/)
  })
})

describe('shouldShowCaption', () => {
  it('shows while playing and not dismissed', () => {
    expect(shouldShowCaption(0.2, false, false)).toBe(true)
  })

  it('never shows under reduced motion, at any progress', () => {
    expect(shouldShowCaption(0, true, false)).toBe(false)
    expect(shouldShowCaption(0.5, true, false)).toBe(false)
  })

  it('hides once dismissed', () => {
    expect(shouldShowCaption(0.2, false, true)).toBe(false)
  })

  it('hides once the growth replay reaches the end', () => {
    expect(shouldShowCaption(1, false, false)).toBe(false)
  })
})
