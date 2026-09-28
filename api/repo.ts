import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleRepoRequest } from '../src/server/handleRepoRequest.ts'

/**
 * Vercel serverless function for `GET /api/repo?owner=&repo=`. Reuses the
 * same `handleRepoRequest` as the Vite dev middleware so behavior matches
 * in dev and in production.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { owner, repo } = req.query
  const { status, body } = await handleRepoRequest({ owner, repo })
  res.status(status).json(body)
}
