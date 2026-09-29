import { describe, expect, it, vi } from 'vitest'
import { RepoError } from '../domain/errors.ts'

vi.mock('./getRepoSnapshot', () => ({
  getRepoSnapshot: vi.fn(),
}))

const { getRepoSnapshot } = await import('./getRepoSnapshot')
const { handleRepoRequest } = await import('./handleRepoRequest')

const mockedGetRepoSnapshot = vi.mocked(getRepoSnapshot)

describe('handleRepoRequest', () => {
  it('returns 200 with the snapshot on success', async () => {
    const snapshot = { meta: { name: 'repo' } } as never
    mockedGetRepoSnapshot.mockResolvedValueOnce(snapshot)

    const result = await handleRepoRequest({ owner: 'o', repo: 'r' })
    expect(result).toEqual({
      status: 200,
      body: snapshot,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  })

  it.each([
    ['invalid_input', 400],
    ['not_found', 404],
    ['private_or_forbidden', 403],
    ['rate_limited', 429],
    ['token_required', 503],
    ['upstream_error', 502],
  ] as const)('maps RepoError(%s) to HTTP %i with a no-store Cache-Control (C2/T8)', async (code, status) => {
    mockedGetRepoSnapshot.mockRejectedValueOnce(new RepoError(code, `boom: ${code}`))

    const result = await handleRepoRequest({ owner: 'o', repo: 'r' })
    expect(result.status).toBe(status)
    expect(result.body).toMatchObject({ error: code, message: `boom: ${code}` })
    expect(result.headers).toEqual({ 'Cache-Control': 'no-store' })
  })

  it('includes retryAfterSeconds when present on the error', async () => {
    mockedGetRepoSnapshot.mockRejectedValueOnce(
      new RepoError('rate_limited', 'slow down', { retryAfterSeconds: 42 }),
    )
    const result = await handleRepoRequest({ owner: 'o', repo: 'r' })
    expect(result.body).toMatchObject({ retryAfterSeconds: 42 })
  })

  it('maps unexpected errors to a generic 500', async () => {
    mockedGetRepoSnapshot.mockRejectedValueOnce(new Error('unexpected'))
    const result = await handleRepoRequest({ owner: 'o', repo: 'r' })
    expect(result.status).toBe(500)
    expect(result.body).toMatchObject({ error: 'internal_error' })
    expect(result.headers).toEqual({ 'Cache-Control': 'no-store' })
  })
})
