import { formatNumber } from './format'
import type { FetchTruncation, PaginationTruncation } from './repo'

const LABELS: Record<keyof FetchTruncation, string> = {
  mergedPullRequests: 'merged pull requests',
  closedPullRequests: 'closed pull requests',
  directCommits: 'direct commits to the default branch',
}

function reasonText(reason: PaginationTruncation['reason']): string {
  return reason === 'time_budget' ? 'fetch time budget reached' : 'a request failed partway through fetching'
}

function describe(kind: keyof FetchTruncation, truncation: PaginationTruncation): string {
  const label = LABELS[kind]
  const ofTotal =
    truncation.totalCount !== null && truncation.totalCount > truncation.fetched
      ? ` of ${formatNumber(truncation.totalCount)}`
      : ''
  return `Showing the latest ${formatNumber(truncation.fetched)} ${label}${ofTotal} (${reasonText(truncation.reason)})`
}

/**
 * Unit 1: an honest, quiet Legend note for when the cold-fetch time budget
 * (or a mid-pagination failure) stopped a pull-request list short of its
 * full history -- `null` when nothing was truncated. Pagination is always
 * most-recent-first (`ORDER BY CREATED_AT/UPDATED_AT DESC`, see
 * `queries.ts`), so this always honestly reads "the latest N", never a
 * fabricated or reordered subset.
 *
 * The time axis stays honest too even when this note is shown:
 * `computeTimeBounds` (`src/domain/shared/timeBounds.ts`) anchors the
 * spore on the repository's own real `meta.createdAt`, not on the oldest
 * *fetched* pull request, so trimming the oldest history never moves where
 * the colony visually appears to start -- only how much of its middle
 * history is drawn.
 */
export function formatFetchTruncationNote(truncated: FetchTruncation | undefined): string | null {
  if (!truncated) return null
  const parts: string[] = []
  if (truncated.mergedPullRequests) parts.push(describe('mergedPullRequests', truncated.mergedPullRequests))
  if (truncated.closedPullRequests) parts.push(describe('closedPullRequests', truncated.closedPullRequests))
  if (truncated.directCommits) parts.push(describe('directCommits', truncated.directCommits))
  if (parts.length === 0) return null
  return parts.join('; ')
}
