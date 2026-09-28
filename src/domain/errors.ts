/**
 * Typed domain errors for repository data access. Pure — no React, no
 * three.js, no fetch. Adapters and the server layer throw these; the API
 * layer maps them to HTTP status codes.
 */

export type RepoErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'private_or_forbidden'
  | 'rate_limited'
  | 'token_required'
  | 'upstream_error'

export interface RepoErrorOptions {
  retryAfterSeconds?: number
  cause?: unknown
}

export class RepoError extends Error {
  readonly code: RepoErrorCode
  readonly retryAfterSeconds: number | undefined

  constructor(code: RepoErrorCode, message: string, options: RepoErrorOptions = {}) {
    super(message)
    this.name = 'RepoError'
    this.code = code
    this.retryAfterSeconds = options.retryAfterSeconds
    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export function isRepoError(value: unknown): value is RepoError {
  return value instanceof RepoError
}
