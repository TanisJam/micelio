/**
 * Pure (no React) logic for `GrowthCaption.tsx`, split out into its own
 * module so the component file only exports a component (`react-refresh/
 * only-export-components` requires this for Fast Refresh to keep working).
 */

export const CAPTIONS: { until: number; text: string }[] = [
  // Post-final-pass (misleading counters/caption): a filament isn't only a
  // pull request -- a solo/small repo's direct-commit bursts (grouped by
  // `groupDirectCommitBursts`) render as real filaments too, and the old
  // wording never mentioned them.
  { until: 0.5, text: 'Each filament is a pull request or a burst of commits · distance from the center is time' },
  { until: 1, text: 'Mushrooms are releases · click anything' },
]

/** Which caption text to show for a given 0..1 playback progress. */
export function captionForProgress(progress: number): string {
  return (CAPTIONS.find((entry) => progress < entry.until) ?? CAPTIONS[CAPTIONS.length - 1]!).text
}

/** Whether the caption should render at all for this progress/reducedMotion/dismissed state. */
export function shouldShowCaption(progress: number, reducedMotion: boolean, dismissed: boolean): boolean {
  return !reducedMotion && !dismissed && progress < 1
}
