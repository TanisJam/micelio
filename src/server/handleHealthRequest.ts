export interface HealthResponseBody {
  tokenConfigured: boolean
}

/**
 * D1/T8: framework-agnostic handler for `GET /api/health`, shared by the
 * Vite dev middleware and the Vercel serverless function (same pattern as
 * `handleRepoRequest`). Reports ONLY whether a `GITHUB_TOKEN` is configured
 * -- never the token's value or any other secret -- so the landing page can
 * decide whether to show examples beyond the bundled offline fixtures
 * without guessing or hardcoding that decision client-side.
 */
export function handleHealthRequest(): HealthResponseBody {
  return { tokenConfigured: Boolean(process.env.GITHUB_TOKEN) }
}
