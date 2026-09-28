import type { RepoSnapshot } from '../../domain/repo.ts'
import pmndrsValtio from './pmndrs-valtio.json' with { type: 'json' }
import expressjsExpress from './expressjs-express.json' with { type: 'json' }

/**
 * Bundled offline fixtures, keyed by lowercase "owner/repo". Used when no
 * GITHUB_TOKEN is configured so the app still demos without network access.
 *
 * `expressjs/express` was chosen for M2 (mycelium network topology) test
 * coverage: it has real branch-from-branch merged PRs (base ref != default
 * branch -- ~106 of 566 merged PRs at generation time, from maintenance
 * activity against non-`master` branches) and a rich closed-unmerged-PR tail
 * (1974 closed PRs at generation time, capped to `CAPS.maxClosedPrs`),
 * unlike `pmndrs/valtio` which has none of the former.
 */
const FIXTURES: Record<string, RepoSnapshot> = {
  'pmndrs/valtio': pmndrsValtio as RepoSnapshot,
  'expressjs/express': expressjsExpress as RepoSnapshot,
}

export function getFixtureSnapshot(owner: string, repo: string): RepoSnapshot | undefined {
  const fixture = FIXTURES[`${owner}/${repo}`.toLowerCase()]
  if (!fixture) return undefined
  // The bundled JSON was generated from a real GitHub fetch (source: 'github'
  // at generation time); tag it 'fixture' to reflect how it is being served now.
  return { ...fixture, source: 'fixture' }
}

export function hasFixture(owner: string, repo: string): boolean {
  return `${owner}/${repo}`.toLowerCase() in FIXTURES
}
