import { describe, expect, it } from 'vitest'
import { formatFetchTruncationNote } from './fetchTruncation'
import type { FetchTruncation } from './repo'

describe('formatFetchTruncationNote', () => {
  it('returns null when nothing was truncated', () => {
    expect(formatFetchTruncationNote(undefined)).toBeNull()
  })

  it('returns null for an empty truncation object', () => {
    expect(formatFetchTruncationNote({})).toBeNull()
  })

  it('describes a time-budget-truncated merged-PR list with a known total', () => {
    const truncated: FetchTruncation = {
      mergedPullRequests: { fetched: 620, totalCount: 1284, reason: 'time_budget' },
    }
    expect(formatFetchTruncationNote(truncated)).toBe(
      'Showing the latest 620 merged pull requests of 1,284 (fetch time budget reached)',
    )
  })

  it('describes an error-truncated closed-PR list with an unknown total', () => {
    const truncated: FetchTruncation = {
      closedPullRequests: { fetched: 0, totalCount: null, reason: 'error' },
    }
    expect(formatFetchTruncationNote(truncated)).toBe(
      'Showing the latest 0 closed pull requests (a request failed partway through fetching)',
    )
  })

  it('omits the "of total" clause when totalCount equals what was fetched (nothing was actually left out)', () => {
    const truncated: FetchTruncation = {
      mergedPullRequests: { fetched: 50, totalCount: 50, reason: 'time_budget' },
    }
    expect(formatFetchTruncationNote(truncated)).toBe('Showing the latest 50 merged pull requests (fetch time budget reached)')
  })

  it('joins both a merged and a closed note when both lists were truncated', () => {
    const truncated: FetchTruncation = {
      mergedPullRequests: { fetched: 620, totalCount: 1284, reason: 'time_budget' },
      closedPullRequests: { fetched: 40, totalCount: 200, reason: 'time_budget' },
    }
    expect(formatFetchTruncationNote(truncated)).toBe(
      'Showing the latest 620 merged pull requests of 1,284 (fetch time budget reached); ' +
        'Showing the latest 40 closed pull requests of 200 (fetch time budget reached)',
    )
  })
})
