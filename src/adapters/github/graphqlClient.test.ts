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

  it('maps a network failure to RepoError("upstream_error")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toBeInstanceOf(RepoError)
    await expect(graphqlRequest('query {}', {}, 'token')).rejects.toMatchObject({ code: 'upstream_error' })
  })
})
