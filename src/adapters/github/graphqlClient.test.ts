import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepoError } from '../../domain/errors.ts'
import { graphqlRequest } from './graphqlClient.ts'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('graphqlRequest', () => {
  it('returns data on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { repository: { name: 'valtio' } } })),
    )
    const data = await graphqlRequest<{ repository: { name: string } }>('query {}', {}, 'token')
    expect(data.repository.name).toBe('valtio')
  })

  it('maps a GraphQL NOT_FOUND error to RepoError("not_found")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository.' }] }),
      ),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('maps a GraphQL FORBIDDEN error to RepoError("private_or_forbidden")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ type: 'FORBIDDEN', message: 'no access' }] })),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({
      code: 'private_or_forbidden',
    })
  })

  it('maps HTTP 404 to RepoError("not_found")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, {})))
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('maps a rate-limited HTTP 403 to RepoError("rate_limited") with retryAfterSeconds', async () => {
    const reset = Math.floor(Date.now() / 1000) + 120
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
      ),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('maps a non-rate-limit HTTP 403 to RepoError("private_or_forbidden")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {})))
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({
      code: 'private_or_forbidden',
    })
  })

  it('maps a GraphQL-level RATE_LIMITED error (HTTP 200) to RepoError("rate_limited")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded.' }] })),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('maps a GraphQL secondary rate limit (untyped, message-only, HTTP 200) to RepoError("rate_limited")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          errors: [{ message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' }],
        }),
      ),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('derives retryAfterSeconds from x-ratelimit-reset on a GraphQL-level rate limit', async () => {
    const reset = Math.floor(Date.now() / 1000) + 90
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded.' }] }, { 'x-ratelimit-reset': String(reset) }),
      ),
    )
    const rejection = await graphqlRequest('query {}', {}, 'token').catch((error: unknown) => error)
    expect(rejection).toMatchObject({ code: 'rate_limited' })
    const retryAfterSeconds = (rejection as { retryAfterSeconds?: number }).retryAfterSeconds
    expect(retryAfterSeconds).toBeGreaterThan(80)
    expect(retryAfterSeconds).toBeLessThanOrEqual(90)
  })

  it('prefers the retry-after header over x-ratelimit-reset when both are present', async () => {
    const reset = Math.floor(Date.now() / 1000) + 9999 // deliberately far off, to prove it's NOT what's used
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          { errors: [{ type: 'RATE_LIMITED', message: 'secondary rate limit' }] },
          { 'retry-after': '30', 'x-ratelimit-reset': String(reset) },
        ),
      ),
    )
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'rate_limited', retryAfterSeconds: 30 })
  })

  it('has no retryAfterSeconds when neither rate-limit header is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded.' }] })),
    )
    const rejection = await graphqlRequest('query {}', {}, 'token').catch((error: unknown) => error)
    expect((rejection as { retryAfterSeconds?: number }).retryAfterSeconds).toBeUndefined()
  })

  it('maps a network failure to RepoError("upstream_error")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toBeInstanceOf(RepoError)
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'upstream_error' })
  })
})
