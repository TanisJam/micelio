import { describe, expect, it } from 'vitest'
import { captionForProgress, shouldShowCaption } from './growthCaptionLogic'

describe('captionForProgress', () => {
  it('shows the "each filament" caption early in the replay', () => {
    expect(captionForProgress(0)).toMatch(/Each filament is a pull request/)
    expect(captionForProgress(0.49)).toMatch(/Each filament is a pull request/)
  })

  // Post-final-pass (misleading counters/caption): a filament can be a
  // direct-commit burst too (`groupDirectCommitBursts`), not only a pull
  // request -- the caption must say so, matching the Legend's own wording.
  it('mentions bursts of commits, not only pull requests', () => {
    expect(captionForProgress(0)).toBe('Each filament is a pull request or a burst of commits · distance from the center is time')
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
