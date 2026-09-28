/**
 * Pagination and size caps for the GitHub adapter. Keeps snapshots bounded
 * so the app stays fast and fixtures stay small, regardless of how large
 * the source repository is.
 */
export const CAPS = {
  /** Most recent merged PRs to fetch in total. */
  maxMergedPrs: 1000,
  /** Page size for each merged-PR GraphQL request. */
  mergedPrsPageSize: 50,
  /** Commits fetched (and kept) per merged PR. */
  commitsPerPr: 20,
  /** Releases fetched; if 0, we fall back to tags. */
  maxReleases: 100,
  /** Open PRs fetched. */
  maxOpenPrs: 50,
  /** Most recent closed-and-not-merged PRs fetched in total (dead-end hyphae). */
  maxClosedPrs: 200,
  /** Page size for each closed-PR GraphQL request. */
  closedPrsPageSize: 50,
  /**
   * Commits fetched (and kept) per open/closed PR -- lower than
   * `commitsPerPr` since these are secondary (dead-end/open-tip) hyphae, not
   * the main loops, so full commit-history fidelity matters less.
   */
  secondaryCommitsPerPr: 8,
  /** Live branches fetched. */
  maxBranches: 100,
  /** Default-branch commits scanned to look for direct (non-PR) commits. */
  directCommitsScanned: 50,
  /** Direct (non-PR) commits kept after scanning. */
  maxDirectCommits: 20,
} as const
