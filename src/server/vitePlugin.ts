import type { Plugin } from 'vite'
import { handleRepoRequest } from './handleRepoRequest.ts'

/**
 * Vite dev-server middleware exposing `GET /api/repo?owner=&repo=`, backed
 * by the same `handleRepoRequest` used by the `api/repo.ts` Vercel function.
 * This makes `pnpm dev` work without any separate API server.
 */
export function huertoApiPlugin(): Plugin {
  return {
    name: 'huerto-api',
    configureServer(server) {
      server.middlewares.use('/api/repo', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        void handleRepoRequest({
          owner: url.searchParams.get('owner') ?? undefined,
          repo: url.searchParams.get('repo') ?? undefined,
        }).then(({ status, body }) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        })
      })
    },
  }
}
