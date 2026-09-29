import { rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../adapters/github/fetchRepoSnapshot.ts', () => ({
  fetchRepoSnapshotFromGitHub: vi.fn(),
}))

const { fetchRepoSnapshotFromGitHub } = await import('../adapters/github/fetchRepoSnapshot.ts')
const { getRepoSnapshot } = await import('./getRepoSnapshot.ts')

const mockedFetchFromGitHub = vi.mocked(fetchRepoSnapshotFromGitHub)

// `getRepoSnapshot`'s `SnapshotCache` also persists to a real on-disk
// directory outside a Vercel environment (local-dev convenience, TTL ~1h),
// which would otherwise make a "still fetches live" test only pass on its
// very first run and silently short-circuit (no live fetch at all) on any
// re-run within that hour. Cleared before every test in this file so the
// suite is repeatable regardless of prior runs.
const DISK_CACHE_DIR = new URL('../../.micelio-cache', import.meta.url).pathname

beforeEach(async () => {
  await rm(DISK_CACHE_DIR, { recursive: true, force: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockedFetchFromGitHub.mockReset()
})

describe('getRepoSnapshot (no GITHUB_TOKEN configured)', () => {
  it('serves the bundled fixture for a known repo', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    const snapshot = await getRepoSnapshot('pmndrs', 'valtio')
    expect(snapshot.source).toBe('fixture')
    expect(snapshot.meta.name.toLowerCase()).toBe('valtio')
  })

  it('is case-insensitive when matching a known fixture', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    const snapshot = await getRepoSnapshot('PMNDRS', 'Valtio')
    expect(snapshot.source).toBe('fixture')
  })

  it('throws RepoError("token_required") for an unknown repo', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    await expect(getRepoSnapshot('some-owner', 'some-unknown-repo')).rejects.toMatchObject({
      code: 'token_required',
    })
  })

  it('throws RepoError("invalid_input") before ever consulting the token or fixtures', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    await expect(getRepoSnapshot('', '')).rejects.toMatchObject({ code: 'invalid_input' })
  })
})

describe('getRepoSnapshot (GITHUB_TOKEN configured)', () => {
  it('serves a bundled fixture instantly instead of hitting the live GitHub API', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'fake-token-for-test')
    const snapshot = await getRepoSnapshot('pmndrs', 'valtio')
    expect(snapshot.source).toBe('fixture')
    expect(mockedFetchFromGitHub).not.toHaveBeenCalled()
  })

  it('still fetches live for a repo with no bundled fixture', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'fake-token-for-test')
    // A distinct owner/repo pair from the "no GITHUB_TOKEN configured"
    // describe block's own unknown-repo test above: both exercise the
    // no-fixture path, and the on-disk cache (`SnapshotCache`, real
    // filesystem, persists across test runs by design for local-dev
    // convenience) would otherwise let this test's live-fetched result leak
    // into that other test as a stale cache hit.
    const liveSnapshot = { source: 'github', meta: { name: 'live-only-repo' } } as never
    mockedFetchFromGitHub.mockResolvedValueOnce(liveSnapshot)

    const snapshot = await getRepoSnapshot('live-only-owner', 'live-only-repo')
    expect(snapshot).toBe(liveSnapshot)
    expect(mockedFetchFromGitHub).toHaveBeenCalledOnce()
  })
})
