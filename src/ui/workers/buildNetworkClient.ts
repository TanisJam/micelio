import { buildNetwork, type NetworkBuildOptions, type NetworkModel } from '../../domain/network'
import type { RepoSnapshot } from '../../domain/repo'

/**
 * B2/T8: `buildNetwork` alone blocks the main thread for ~1.3s at the
 * server's real caps (1000 merged PRs x up to 20 commits each, 200 closed,
 * 50 open PRs, 100 branches) -- freezing input and the "Growing hyphae..."
 * loading screen's own animation for that whole time. `buildNetworkAsync`
 * runs the SAME pure `buildNetwork` inside a Web Worker when one is
 * available, and falls back to calling it synchronously (identical result,
 * just blocking) when it isn't -- most importantly in Vitest's `node` test
 * environment, which has no `Worker` global, so every existing test that
 * exercises `buildNetwork` keeps working unchanged.
 */

export interface BuildNetworkWorkerRequest {
  snapshot: RepoSnapshot
  options?: Partial<NetworkBuildOptions>
}

export type BuildNetworkWorkerResponse = { model: NetworkModel } | { error: string }

/** The minimal `Worker` surface this module needs -- lets tests inject a fake worker without a real `Worker`/DOM environment. */
export interface MinimalWorker {
  postMessage(data: BuildNetworkWorkerRequest): void
  terminate(): void
  onmessage: ((event: { data: BuildNetworkWorkerResponse }) => void) | null
  onerror: ((event: { message?: string }) => void) | null
}

/**
 * The default worker factory: a real module Worker running
 * `buildNetworkWorker.ts`, or `null` when this environment has no `Worker`
 * global at all (SSR, most test runners) or construction throws for any
 * other reason (e.g. a restrictive CSP) -- either way, `buildNetworkAsync`
 * treats `null` as "fall back to synchronous".
 */
function createDefaultWorker(): MinimalWorker | null {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('./buildNetworkWorker.ts', import.meta.url), { type: 'module' }) as unknown as MinimalWorker
  } catch {
    return null
  }
}

/**
 * Builds a `NetworkModel` off the main thread when possible, resolving with
 * the exact same value `buildNetwork(snapshot, options)` would return
 * synchronously (the domain stays pure and structured-clone-safe -- plain
 * numbers/strings/arrays/objects only, see `domain/network/types.ts` -- so
 * round-tripping it through `postMessage` never loses or mutates anything).
 *
 * `createWorker` is injectable (default `createDefaultWorker`) purely for
 * unit testing the request/response/fallback flow without a real `Worker`.
 */
export function buildNetworkAsync(
  snapshot: RepoSnapshot,
  options: Partial<NetworkBuildOptions> = {},
  createWorker: () => MinimalWorker | null = createDefaultWorker,
): Promise<NetworkModel> {
  const maybeWorker = createWorker()
  if (!maybeWorker) return Promise.resolve(buildNetwork(snapshot, options))
  const worker: MinimalWorker = maybeWorker

  return new Promise((resolve) => {
    let settled = false
    function settle(model: NetworkModel) {
      if (settled) return
      settled = true
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
      resolve(model)
    }

    worker.onmessage = (event) => {
      const data = event.data
      if ('error' in data) {
        // The worker itself failed unexpectedly (e.g. a bug that only
        // reproduces off-thread) -- fall back to a synchronous build rather
        // than leaving the viewer stuck on "Growing hyphae...".
        settle(buildNetwork(snapshot, options))
      } else {
        settle(data.model)
      }
    }
    worker.onerror = () => {
      settle(buildNetwork(snapshot, options))
    }
    worker.postMessage({ snapshot, options })
  })
}
