import { RepoError } from './errors.ts'
import type { RepoIdentity } from './repo.ts'

// GitHub usernames/orgs: alphanumeric or single hyphens, 1-39 chars, no
// leading/trailing/double hyphen.
const OWNER_PATTERN = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/
// GitHub repository names: alphanumeric, dot, underscore, hyphen, 1-100 chars.
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/

/**
 * Validates and normalizes raw `owner`/`repo` input (e.g. from a query
 * string). Throws a `RepoError('invalid_input')` for anything malformed.
 */
export function validateRepoIdentity(ownerRaw: unknown, repoRaw: unknown): RepoIdentity {
  const owner = typeof ownerRaw === 'string' ? ownerRaw.trim() : ''
  const repo = typeof repoRaw === 'string' ? repoRaw.trim() : ''

  if (!owner || !repo) {
    throw new RepoError('invalid_input', 'Both "owner" and "repo" are required.')
  }
  if (!OWNER_PATTERN.test(owner)) {
    throw new RepoError('invalid_input', `"${owner}" is not a valid GitHub owner name.`)
  }
  if (!REPO_PATTERN.test(repo)) {
    throw new RepoError('invalid_input', `"${repo}" is not a valid GitHub repository name.`)
  }

  return { owner, repo }
}
