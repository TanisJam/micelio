import { isRepoError, type RepoErrorCode } from '../domain/errors.ts'
import type { RepoSnapshot } from '../domain/repo.ts'
import { getRepoSnapshot } from './getRepoSnapshot.ts'

export interface RepoRequestQuery {
  owner?: unknown
  repo?: unknown
}

export interface RepoErrorBody {
  error: RepoErrorCode | 'internal_error'
  message: string
  retryAfterSeconds?: number
}

export interface RepoRequestResult {
  status: number
  body: RepoSnapshot | RepoErrorBody
  /** C2/T8: both `api/repo.ts` and the Vite dev middleware apply these as-is -- computed once, here, so the caching rule lives in exactly one place. */
  headers: Record<string, string>
}

const STATUS_BY_CODE: Record<RepoErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  private_or_forbidden: 403,
  rate_limited: 429,
  token_required: 503,
  upstream_error: 502,
}

/**
 * C2/T8: a successful snapshot is safe to cache at the edge/CDN for a while
 * (repository history doesn't change minute-to-minute) with a long
 * stale-while-revalidate window, since `getRepoSnapshot`'s own in-memory/
 * on-disk TTL cache already refreshes hourly regardless. An error response
 * (including a transient rate-limit/upstream failure) must never be cached
 * -- caching a 429/502/503 would keep serving a stale failure long after
 * the underlying problem clears.
 */
function cacheControlFor(status: number): string {
  return status === 200 ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store'
}

/**
 * Framework-agnostic handler for `GET /api/repo?owner=&repo=`, shared by the
 * Vite dev middleware and the Vercel serverless function so both entry
 * points behave identically.
 */
export async function handleRepoRequest(query: RepoRequestQuery): Promise<RepoRequestResult> {
  try {
    const snapshot = await getRepoSnapshot(query.owner, query.repo)
    return { status: 200, body: snapshot, headers: { 'Cache-Control': cacheControlFor(200) } }
  } catch (error) {
    if (isRepoError(error)) {
      const status = STATUS_BY_CODE[error.code]
      return {
        status,
        body: {
          error: error.code,
          message: error.message,
          ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        },
        headers: { 'Cache-Control': cacheControlFor(status) },
      }
    }
    return {
      status: 500,
      body: { error: 'internal_error', message: 'Unexpected server error.' },
      headers: { 'Cache-Control': cacheControlFor(500) },
    }
  }
}
