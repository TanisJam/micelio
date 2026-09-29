import { RepoError } from '../../domain/errors.ts'

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql'

interface GraphQlError {
  type?: string
  message: string
}

interface GraphQlResponse<T> {
  data?: T
  errors?: GraphQlError[]
}

/**
 * Derives a `retryAfterSeconds` hint from whichever rate-limit header the
 * response actually carries: `retry-after` (GitHub's secondary-rate-limit
 * convention, already a seconds count) takes priority when present, falling
 * back to `x-ratelimit-reset` (an epoch-seconds timestamp, so it needs
 * converting to a relative delay). `undefined` when neither header is
 * present or parseable -- never a fabricated number.
 */
function parseRetryAfterSeconds(response: Response): number | undefined {
  const retryAfterHeader = response.headers.get('retry-after')
  if (retryAfterHeader !== null) {
    const seconds = Number(retryAfterHeader)
    if (Number.isFinite(seconds)) return Math.max(0, seconds)
  }
  const resetHeader = response.headers.get('x-ratelimit-reset')
  if (resetHeader !== null) {
    const resetEpochSeconds = Number(resetHeader)
    if (Number.isFinite(resetEpochSeconds)) return Math.max(0, resetEpochSeconds - Math.floor(Date.now() / 1000))
  }
  return undefined
}

/**
 * Minimal fetch-based GitHub GraphQL client. Maps transport and GraphQL-level
 * failures to typed `RepoError`s so the rest of the app never has to parse
 * GitHub-specific error shapes.
 */
export async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'micelio-app',
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch (cause) {
    throw new RepoError('upstream_error', 'Could not reach the GitHub API.', { cause })
  }

  if (response.status === 401) {
    throw new RepoError('upstream_error', 'GitHub rejected the configured GITHUB_TOKEN (401).')
  }

  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      const resetHeader = Number(response.headers.get('x-ratelimit-reset') ?? '0')
      const retryAfterSeconds = Math.max(0, resetHeader - Math.floor(Date.now() / 1000))
      throw new RepoError('rate_limited', 'GitHub API rate limit exceeded.', { retryAfterSeconds })
    }
    throw new RepoError('private_or_forbidden', 'GitHub denied access to this repository.')
  }

  if (response.status === 404) {
    throw new RepoError('not_found', 'Repository not found.')
  }

  if (!response.ok) {
    throw new RepoError('upstream_error', `GitHub API responded with HTTP ${response.status}.`)
  }

  const body = (await response.json()) as GraphQlResponse<T>

  if (body.errors && body.errors.length > 0) {
    const notFound = body.errors.find((error) => error.type === 'NOT_FOUND')
    if (notFound) {
      throw new RepoError('not_found', notFound.message)
    }
    const forbidden = body.errors.find(
      (error) => error.type === 'FORBIDDEN' || error.type === 'INSUFFICIENT_SCOPES',
    )
    if (forbidden) {
      throw new RepoError('private_or_forbidden', forbidden.message)
    }
    // C1/T8: GitHub returns a GraphQL-level (primary or secondary) rate
    // limit as an ordinary HTTP 200 with an `errors` entry -- never a 403,
    // so the HTTP-status-based rate-limit handling above never sees it.
    // Without this, it silently fell through to the generic
    // `upstream_error` branch below, losing both the typed `rate_limited`
    // code AND any reset time the response actually carried.
    const rateLimited = body.errors.find(
      (error) => error.type === 'RATE_LIMITED' || /rate limit|secondary rate/i.test(error.message),
    )
    if (rateLimited) {
      throw new RepoError('rate_limited', rateLimited.message, { retryAfterSeconds: parseRetryAfterSeconds(response) })
    }
    throw new RepoError(
      'upstream_error',
      body.errors.map((error) => error.message).join('; '),
    )
  }

  if (!body.data) {
    throw new RepoError('upstream_error', 'GitHub GraphQL response had no data.')
  }

  return body.data
}
