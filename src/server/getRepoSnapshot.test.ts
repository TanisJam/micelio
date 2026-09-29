import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../adapters/github/fetchRepoSnapshot.ts', () => ({
  fetchRepoSnapshotFromGitHub: vi.fn(),
}))

const { fetchRepoSnapshotFromGitHub } = await import('../adapters/github/fetchRepoSnapshot.ts')
const { getRepoSnapshot } = await import('./getRepoSnapshot.ts')

const mockedFetchFromGitHub = vi.mocked(fetchRepoSnapshotFromGitHub)

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
    const liveSnapshot = { source: 'github', meta: { name: 'some-unknown-repo' } } as never
    mockedFetchFromGitHub.mockResolvedValueOnce(liveSnapshot)

    const snapshot = await getRepoSnapshot('some-owner', 'some-unknown-repo')
    expect(snapshot).toBe(liveSnapshot)
    expect(mockedFetchFromGitHub).toHaveBeenCalledOnce()
  })
})
