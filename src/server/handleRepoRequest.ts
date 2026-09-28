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
 * Framework-agnostic handler for `GET /api/repo?owner=&repo=`, shared by the
 * Vite dev middleware and the Vercel serverless function so both entry
 * points behave identically.
 */
export async function handleRepoRequest(query: RepoRequestQuery): Promise<RepoRequestResult> {
  try {
    const snapshot = await getRepoSnapshot(query.owner, query.repo)
    return { status: 200, body: snapshot }
  } catch (error) {
    if (isRepoError(error)) {
      return {
        status: STATUS_BY_CODE[error.code],
        body: {
          error: error.code,
          message: error.message,
          ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        },
      }
    }
    return {
      status: 500,
      body: { error: 'internal_error', message: 'Unexpected server error.' },
    }
  }
}
