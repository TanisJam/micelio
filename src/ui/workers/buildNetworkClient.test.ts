import { describe, expect, it } from 'vitest'
import { buildNetwork } from '../../domain/network'
import { makeMergedPr, makeSnapshot } from '../../domain/shared/testHelpers'
import { buildNetworkAsync, type BuildNetworkWorkerRequest, type BuildNetworkWorkerResponse, type MinimalWorker } from './buildNetworkClient'

const SNAPSHOT = makeSnapshot({ mergedPullRequests: [makeMergedPr(), makeMergedPr()] })

/** A fake worker that immediately "responds" with whatever `respond` computes from the posted request -- no real Worker/thread involved. */
function fakeWorker(respond: (request: BuildNetworkWorkerRequest) => BuildNetworkWorkerResponse): { worker: MinimalWorker; terminated: () => boolean } {
  let terminated = false
  const worker: MinimalWorker = {
    postMessage: (data) => {
      queueMicrotask(() => worker.onmessage?.({ data: respond(data) }))
    },
    terminate: () => {
      terminated = true
    },
    onmessage: null,
    onerror: null,
  }
  return { worker, terminated: () => terminated }
}

describe('buildNetworkAsync', () => {
  it('falls back to a synchronous buildNetwork call when no Worker is available (createWorker returns null)', async () => {
    const result = await buildNetworkAsync(SNAPSHOT, {}, () => null)
    expect(result).toEqual(buildNetwork(SNAPSHOT))
  })

  it('resolves with the model the worker posts back, and terminates the worker afterward', async () => {
    const { worker, terminated } = fakeWorker((request) => ({ model: buildNetwork(request.snapshot, request.options) }))
    const result = await buildNetworkAsync(SNAPSHOT, {}, () => worker)
    expect(result).toEqual(buildNetwork(SNAPSHOT))
    expect(terminated()).toBe(true)
  })

  it('posts the snapshot and options to the worker', async () => {
    let received: BuildNetworkWorkerRequest | null = null
    const worker: MinimalWorker = {
      postMessage: (data) => {
        received = data
        queueMicrotask(() => worker.onmessage?.({ data: { model: buildNetwork(data.snapshot, data.options) } }))
      },
      terminate: () => {},
      onmessage: null,
      onerror: null,
    }
    await buildNetworkAsync(SNAPSHOT, { maxHyphae: 10 }, () => worker)
    expect(received).toEqual({ snapshot: SNAPSHOT, options: { maxHyphae: 10 } })
  })

  it('falls back to a synchronous build if the worker reports an error', async () => {
    const { worker, terminated } = fakeWorker(() => ({ error: 'boom' }))
    const result = await buildNetworkAsync(SNAPSHOT, {}, () => worker)
    expect(result).toEqual(buildNetwork(SNAPSHOT))
    expect(terminated()).toBe(true)
  })

  it('falls back to a synchronous build if the worker itself errors (onerror)', async () => {
    let terminated = false
    const worker: MinimalWorker = {
      postMessage: () => {
        queueMicrotask(() => worker.onerror?.({ message: 'worker crashed' }))
      },
      terminate: () => {
        terminated = true
      },
      onmessage: null,
      onerror: null,
    }
    const result = await buildNetworkAsync(SNAPSHOT, {}, () => worker)
    expect(result).toEqual(buildNetwork(SNAPSHOT))
    expect(terminated).toBe(true)
  })

  it('ignores a message received after the worker already settled (no double-resolve)', async () => {
    const worker: MinimalWorker = {
      postMessage: () => {
        queueMicrotask(() => {
          worker.onmessage?.({ data: { model: buildNetwork(SNAPSHOT) } })
          // A second, late message must not throw or change the resolved value.
          worker.onmessage?.({ data: { error: 'late' } })
        })
      },
      terminate: () => {},
      onmessage: null,
      onerror: null,
    }
    const result = await buildNetworkAsync(SNAPSHOT, {}, () => worker)
    expect(result).toEqual(buildNetwork(SNAPSHOT))
  })
})
