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
  /**
   * Commits fetched (and kept) per merged PR. Unit 1 (cold-fetch time
   * budget): lowered from 20 -> 10 -- each fetched commit is a mycelial
   * "fine hair", already capped for rendering (`renderHints.ts`/M3), so
   * halving this halves each merged-PR page's GraphQL node count/latency
   * with no visible loss (a repo with >10 commits on a PR already only
   * rendered its first 20 hairs before; now it renders its first 10).
   */
  commitsPerPr: 10,
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
  /**
   * Unit 2: default-branch commit history scanned (paginated, like merged/
   * closed PRs) to look for direct (non-PR) commits, up to this total raw
   * commit count -- not the count kept after filtering out PR-associated
   * commits, which is usually much smaller. Bounded by the same wall-clock
   * `fetchTimeBudgetMs` as merged/closed-PR pagination.
   */
  maxDirectCommitsScanned: 1000,
  /** Page size for each default-branch history GraphQL request. */
  directCommitsPageSize: 100,
  /**
   * Unit 1: a global wall-clock budget (from the start of the whole snapshot
   * fetch) for the merged-PR and closed-PR pagination loops. Each loop
   * checks elapsed time BEFORE requesting its next page; once the budget is
   * exceeded, it stops (keeping whatever pages already succeeded) instead of
   * continuing to chase `maxMergedPrs`/`maxClosedPrs`, and the snapshot is
   * returned with an honest `truncated` note rather than blowing past
   * Vercel's `maxDuration` (60s, see `vercel.json`). Chosen so cold fetches
   * for large repos (measured 93-94s for facebook/react and vitejs/vite
   * before this change) land well under both the 60s hard limit and a
   * comfortable UX target (~25s).
   */
  fetchTimeBudgetMs: 22_000,
} as const
