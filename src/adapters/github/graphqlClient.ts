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
        'User-Agent': 'huerto-app',
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
