import { buildNetwork } from '../../domain/network'
import type { BuildNetworkWorkerRequest, BuildNetworkWorkerResponse } from './buildNetworkClient'

/**
 * The actual Web Worker entry point (B2/T8), bundled by Vite via
 * `new Worker(new URL('./buildNetworkWorker.ts', import.meta.url), { type:
 * 'module' })` in `buildNetworkClient.ts`. Thin glue only -- the real work
 * is the same pure `buildNetwork` used everywhere else; this file just
 * wires it to `postMessage`.
 *
 * Cast through `unknown` rather than adding the `webworker` TS lib: this
 * project's `tsconfig.json` includes `DOM` (for the rest of the app), and
 * TypeScript doesn't allow mixing the `dom` and `webworker` libs in one
 * program (both declare a conflicting global `self`).
 */
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<BuildNetworkWorkerRequest>) => void) | null
  postMessage: (data: BuildNetworkWorkerResponse) => void
}

ctx.onmessage = (event) => {
  try {
    const model = buildNetwork(event.data.snapshot, event.data.options ?? {})
    ctx.postMessage({ model })
  } catch (error) {
    ctx.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
