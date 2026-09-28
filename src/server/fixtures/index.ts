import type { RepoSnapshot } from '../../domain/repo.ts'
import pmndrsValtio from './pmndrs-valtio.json' with { type: 'json' }

/**
 * Bundled offline fixtures, keyed by lowercase "owner/repo". Used when no
 * GITHUB_TOKEN is configured so the app still demos without network access.
 */
const FIXTURES: Record<string, RepoSnapshot> = {
  'pmndrs/valtio': pmndrsValtio as RepoSnapshot,
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
