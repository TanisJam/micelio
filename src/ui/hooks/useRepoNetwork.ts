import { useEffect, useMemo, useState } from 'react'
import { buildNetwork, type NetworkModel } from '../../domain/network'
import type { RepoErrorCode } from '../../domain/errors'
import type { RepoSnapshot } from '../../domain/repo'
import type { RepoRequestErrorInfo } from '../../domain/repoRequestState'

export interface RepoNetworkState {
  status: 'loading' | 'error' | 'ready'
  model: NetworkModel | null
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
 * The network-model counterpart of `useRepoTree` (fetch logic identical --
 * see that hook's doc): fetches a `RepoSnapshot` and derives the mycelium
 * `NetworkModel` via `buildNetwork(snapshot, { layout: 'colony' })`, the
 * layout adopted for M3 per M2c/M2d's visual iteration (see
 * `odd/tasks/huerto-mvp.md`).
 */
export function useRepoNetwork(owner: string, repo: string): RepoNetworkState {
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [errorInfo, setErrorInfo] = useState<RepoRequestErrorInfo | null>(null)

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

  const model = useMemo(() => (snapshot ? buildNetwork(snapshot, { layout: 'colony' }) : null), [snapshot])

  if (errorInfo) return { status: 'error', model: null, snapshot: null, errorInfo }
  if (!model) return { status: 'loading', model: null, snapshot: null, errorInfo: null }
  return { status: 'ready', model, snapshot, errorInfo: null }
}
