import type { Plugin } from 'vite'
import { handleHealthRequest } from './handleHealthRequest.ts'
import { handleRepoRequest } from './handleRepoRequest.ts'

/**
 * Vite dev-server middleware exposing `GET /api/repo?owner=&repo=` and
 * `GET /api/health` (D1/T8), backed by the same handlers the `api/*.ts`
 * Vercel functions use. This makes `pnpm dev` work without any separate API
 * server.
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
        }).then(({ status, body, headers }) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
          res.end(JSON.stringify(body))
        })
      })
      server.middlewares.use('/api/health', (_req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(handleHealthRequest()))
      })
    },
  }
}
