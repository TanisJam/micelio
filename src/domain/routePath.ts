import type { RepoIdentity } from './repo'

/** Builds the viewer route path for a repository, e.g. `/pmndrs/valtio`. Pure -- no router dependency, so it's usable from the landing page, tests, and the router config alike. */
export function buildRepoPath({ owner, repo }: RepoIdentity): string {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}
