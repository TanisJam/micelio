import { useEffect, useMemo, useState } from 'react'
import { buildTree, type TreeModel } from '../../domain/tree'
import type { RepoSnapshot } from '../../domain/repo'

export interface RepoTreeState {
  status: 'loading' | 'error' | 'ready'
  model: TreeModel | null
  error: string | null
}

/**
 * Fetches a `RepoSnapshot` from `/api/repo?owner=&repo=` (served by the Vite
 * dev middleware or the Vercel function -- falls back to a bundled fixture
 * offline, see `src/server/getRepoSnapshot.ts`) and derives the pure
 * `TreeModel` from it. This is intentionally minimal: full loading/error
 * product states belong to T7/T8, this just must not crash.
 */
export function useRepoTree(owner: string, repo: string): RepoTreeState {
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Note: `owner`/`repo` are constant in this MVP (no `/owner/repo` routing
    // yet -- T7 scope), so this effect only ever runs once; it intentionally
    // does not reset state on re-run to avoid a synchronous setState-in-effect.
    fetch(`/api/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then(async (response) => {
        const body = (await response.json()) as RepoSnapshot | { error: string; message: string }
        if (cancelled) return
        if (!response.ok || 'error' in body) {
          const message = 'message' in body ? body.message : `Request failed with status ${response.status}`
          setError(message)
          return
        }
        setSnapshot(body)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error fetching repository data.')
      })

    return () => {
      cancelled = true
    }
  }, [owner, repo])

  const model = useMemo(() => (snapshot ? buildTree(snapshot) : null), [snapshot])

  if (error) return { status: 'error', model: null, error }
  if (!model) return { status: 'loading', model: null, error: null }
  return { status: 'ready', model, error: null }
}
