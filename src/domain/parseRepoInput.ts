import type { RepoIdentity } from './repo'
import { validateRepoIdentity } from './validateRepoIdentity'

/**
 * Parses the landing page's free-text repository input into an
 * `owner/repo` identity. Accepts:
 * - plain `owner/repo`
 * - a full GitHub URL, with or without a scheme/`www.`, and with any
 *   trailing path/query/hash (e.g. a permalink to a file, PR or commit)
 * - a `git@github.com:owner/repo.git` SSH remote
 *
 * Never throws -- returns `null` for anything that doesn't resolve to a
 * valid `{owner, repo}` pair (reusing `validateRepoIdentity`'s real GitHub
 * naming rules), so the caller can render a friendly inline validation
 * message instead of a crash.
 */
export function parseRepoInput(input: string): RepoIdentity | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(trimmed)
  if (sshMatch) return tryValidate(sshMatch[1]!, sshMatch[2]!)

  const urlMatch = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(trimmed)
  if (urlMatch) return tryValidate(urlMatch[1]!, urlMatch[2]!)

  const plainMatch = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed)
  if (plainMatch) return tryValidate(plainMatch[1]!, plainMatch[2]!)

  return null
}

function tryValidate(owner: string, repo: string): RepoIdentity | null {
  try {
    return validateRepoIdentity(owner, repo)
  } catch {
    return null
  }
}
