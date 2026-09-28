import { useEffect, useMemo, useState } from 'react'
import type { RepoErrorCode } from '../../domain/errors'
import type { RepoSnapshot } from '../../domain/repo'
import type { RepoRequestErrorInfo } from '../../domain/repoRequestState'
import { buildTree, type TreeModel } from '../../domain/tree'

export interface RepoTreeState {
  status: 'loading' | 'error' | 'ready'
  model: TreeModel | null
  snapshot: RepoSnapshot | null
  errorInfo: RepoRequestErrorInfo | null
}

interface RepoErrorResponseBody {
  error: RepoErrorCode | 'internal_error'
  message: string
  retryAfterSeconds?: number
}

function isRepoErrorResponseBody(value: unknown): value is RepoErrorResponseBody {
  return typeof value === 'object' && value !== null && 'error' in value && 'message' in value
}

/**
 * Fetches a `RepoSnapshot` from `/api/repo?owner=&repo=` (served by the Vite
 * dev middleware or the Vercel function -- falls back to a bundled fixture
 * offline, see `src/server/getRepoSnapshot.ts`) and derives the pure
 * `TreeModel` from it. Re-fetches whenever `owner`/`repo` change (T7
 * routing), resetting any previous snapshot/error first so a repo switch
 * never briefly shows the *previous* repo's stale data or error.
 */
export function useRepoTree(owner: string, repo: string): RepoTreeState {
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [errorInfo, setErrorInfo] = useState<RepoRequestErrorInfo | null>(null)

  // Reset during render (not inside the effect below) when the identity
  // changes, so a repo switch never briefly shows the *previous* repo's
  // stale snapshot/error -- see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const key = `${owner}/${repo}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setSnapshot(null)
    setErrorInfo(null)
  }

  useEffect(() => {
    let cancelled = false

    fetch(`/api/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null)
        if (cancelled) return

        if (response.ok && !isRepoErrorResponseBody(body)) {
          setSnapshot(body as RepoSnapshot)
          return
        }

        if (isRepoErrorResponseBody(body)) {
          setErrorInfo({
            code: body.error === 'internal_error' ? 'upstream_error' : body.error,
            message: body.message,
            retryAfterSeconds: body.retryAfterSeconds,
          })
        } else {
          setErrorInfo({ code: 'upstream_error', message: `Request failed with status ${response.status}.` })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorInfo({
          code: 'network_error',
          message: err instanceof Error ? err.message : 'Unknown network error fetching repository data.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [owner, repo])

  const model = useMemo(() => (snapshot ? buildTree(snapshot) : null), [snapshot])

  if (errorInfo) return { status: 'error', model: null, snapshot: null, errorInfo }
  if (!model) return { status: 'loading', model: null, snapshot: null, errorInfo: null }
  return { status: 'ready', model, snapshot, errorInfo: null }
}
