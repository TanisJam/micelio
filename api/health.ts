import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleHealthRequest } from '../src/server/handleHealthRequest.ts'

/**
 * D1/T8: Vercel serverless function for `GET /api/health`. Reuses the same
 * `handleHealthRequest` as the Vite dev middleware. Never cached (the
 * whole point is telling the CURRENT deployment's live configuration).
 */
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(handleHealthRequest())
}
