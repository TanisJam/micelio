import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRepoSnapshot } from './getRepoSnapshot.ts'

afterEach(() => {
  vi.unstubAllEnvs()
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
