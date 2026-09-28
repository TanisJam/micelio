import { fetchRepoSnapshotFromGitHub } from '../adapters/github/fetchRepoSnapshot.ts'
import { RepoError } from '../domain/errors.ts'
import type { RepoSnapshot } from '../domain/repo.ts'
import { validateRepoIdentity } from '../domain/validateRepoIdentity.ts'
import { getFixtureSnapshot } from './fixtures/index.ts'
import { SnapshotCache } from './snapshotCache.ts'

const ONE_HOUR_MS = 60 * 60 * 1000

// Vercel's production filesystem is read-only outside of /tmp; only persist
// the on-disk cache in a normal (non-Vercel) environment, i.e. local dev.
const diskCacheDir = process.env.VERCEL ? null : new URL('../../.huerto-cache', import.meta.url).pathname

const cache = new SnapshotCache(ONE_HOUR_MS, diskCacheDir)

/**
 * Resolves a full `RepoSnapshot` for `ownerRaw/repoRaw`:
 * 1. Validates input.
 * 2. Returns a cached snapshot if still fresh (TTL ~1h).
 * 3. Fetches live from GitHub when GITHUB_TOKEN is configured.
 * 4. Otherwise falls back to a bundled fixture for known repos.
 * 5. Otherwise throws a typed `RepoError('token_required')`.
 */
export async function getRepoSnapshot(ownerRaw: unknown, repoRaw: unknown): Promise<RepoSnapshot> {
  const { owner, repo } = validateRepoIdentity(ownerRaw, repoRaw)

  const cached = await cache.get(owner, repo)
  if (cached) return cached

  const token = process.env.GITHUB_TOKEN
  if (token) {
    const snapshot = await fetchRepoSnapshotFromGitHub(owner, repo, token)
    await cache.set(owner, repo, snapshot)
    return snapshot
  }

  const fixture = getFixtureSnapshot(owner, repo)
  if (fixture) return fixture

  throw new RepoError(
    'token_required',
    `No GITHUB_TOKEN is configured and no bundled fixture exists for ${owner}/${repo}.`,
  )
}
