import { useEffect, useState } from 'react'
import type { NetworkModel } from '../../domain/network'
import type { RepoErrorCode } from '../../domain/errors'
import type { RepoSnapshot } from '../../domain/repo'
import type { RepoRequestErrorInfo } from '../../domain/repoRequestState'
import { buildNetworkAsync } from '../workers/buildNetworkClient'

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
 * Fetches a `RepoSnapshot` and derives the mycelium `NetworkModel` (colony
 * layout -- the product's only mycelium visualization since M4 removed the
 * earlier spiral layout) via `buildNetworkAsync`, which runs the actual
 * `buildNetwork` computation in a Web Worker when available (B2/T8: it
 * blocks the main thread for ~1.3s at the server's real caps).
 */
export function useRepoNetwork(owner: string, repo: string): RepoNetworkState {
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [errorInfo, setErrorInfo] = useState<RepoRequestErrorInfo | null>(null)
  const [model, setModel] = useState<NetworkModel | null>(null)

  const key = `${owner}/${repo}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setSnapshot(null)
    setErrorInfo(null)
    setModel(null)
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

  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    // B2/T8: off the main thread when a `Worker` is available, falling back
    // to a synchronous `buildNetwork` call otherwise (see
    // `buildNetworkAsync`'s own doc) -- either way, the "loading" status
    // below covers the whole compute, same as it already covered the fetch.
    buildNetworkAsync(snapshot).then((result) => {
      if (!cancelled) setModel(result)
    })
    return () => {
      cancelled = true
    }
  }, [snapshot])

  if (errorInfo) return { status: 'error', model: null, snapshot: null, errorInfo }
  if (!model) return { status: 'loading', model: null, snapshot: null, errorInfo: null }
  return { status: 'ready', model, snapshot, errorInfo: null }
}
