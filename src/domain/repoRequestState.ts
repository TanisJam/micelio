import type { RepoErrorCode } from './errors'

/**
 * The product state the UI should render for a repository request (P6).
 * Pure -- no React, no fetch. `network_error` isn't a `RepoErrorCode` (the
 * server never produces it): it's what the client reports when `fetch`
 * itself rejects (offline, DNS failure, aborted), before any HTTP response
 * exists to carry a code.
 */
export type RepoRequestErrorCode = RepoErrorCode | 'network_error'

export interface RepoRequestErrorInfo {
  code: RepoRequestErrorCode
  message: string
  /** Present only for `rate_limited`, when the server knows when the limit resets. */
  retryAfterSeconds?: number
}

export type RepoViewStateKind =
  | 'invalid_input'
  | 'not_found'
  | 'private_or_forbidden'
  | 'rate_limited'
  | 'token_required'
  | 'network_error'
  | 'upstream_error'

/**
 * Maps a `RepoRequestErrorInfo` to the discrete product state the UI
 * renders a dedicated screen for (P6: loading/error/not-found/rate-limited/
 * token-required/network-error). `upstream_error` (an unexpected 5xx, or
 * the server's generic `internal_error`) is the fallback for anything not
 * individually designed for.
 */
export function mapErrorToViewState(info: Pick<RepoRequestErrorInfo, 'code'>): RepoViewStateKind {
  switch (info.code) {
    case 'invalid_input':
    case 'not_found':
    case 'private_or_forbidden':
    case 'rate_limited':
    case 'token_required':
    case 'network_error':
      return info.code
    default:
      return 'upstream_error'
  }
}
