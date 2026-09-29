import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { parseRepoInput } from '../../domain/parseRepoInput'
import { buildRepoPath } from '../../domain/routePath'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ui } from '../theme/tokens'

// D1/T8: BOTH bundled offline fixtures (`src/server/fixtures/index.ts`) --
// guaranteed to render even with no `GITHUB_TOKEN` configured, so they're
// shown first, always, clearly labeled as instant samples. `expressjs/
// express` used to be missing from this list entirely, even though it's
// just as much a real bundled fixture as `pmndrs/valtio`.
const INSTANT_SAMPLES = [
  { owner: 'pmndrs', repo: 'valtio' },
  { owner: 'expressjs', repo: 'express' },
]
// Real, well-known repositories that only work once a `GITHUB_TOKEN` is
// configured -- hidden entirely (not just left to fail into the
// token-required state) unless `/api/health` reports one is actually
// configured on this deployment (D1/T8).
const LIVE_EXAMPLES = [
  { owner: 'facebook', repo: 'react' },
  { owner: 'vuejs', repo: 'core' },
  { owner: 'sveltejs', repo: 'svelte' },
]

function ExampleChip({ owner, repo }: { owner: string; repo: string }) {
  return (
    <Link
      href={buildRepoPath({ owner, repo })}
      style={{
        fontFamily: ui.fontBody,
        fontSize: '0.8rem',
        padding: `${ui.space(1)} ${ui.space(3)}`,
        borderRadius: ui.space(4),
        border: `1px solid ${ui.panelBorder}`,
        color: ui.text,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {owner}/{repo}
    </Link>
  )
}

/**
 * A real render of the mycelium colony (M4: `pnpm hero-images`, generated
 * from the `expressjs/express` fixture, fully grown, no UI chrome) --
 * replaces the earlier abstract animated SVG placeholder now that the
 * network scene's visual metaphor is finished, not still being redesigned.
 * D1/T8: captioned so it's honest about which real repository it's from,
 * not left looking like generic decorative art.
 */
function Hero() {
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: ui.space(2), alignItems: 'center' }}>
      <img
        src="/hero.png"
        alt="A bioluminescent mycelium galaxy grown from a real repository's history -- glowing cyan and white filaments spiral outward from a central spore, with small cream mushrooms marking releases."
        style={{
          width: '100%',
          maxWidth: 420,
          aspectRatio: '4 / 3',
          objectFit: 'cover',
          borderRadius: ui.space(4),
          border: `1px solid ${ui.panelBorder}`,
          display: 'block',
        }}
      />
      <figcaption style={{ margin: 0, fontSize: '0.78rem', color: ui.textMuted }}>Example: expressjs/express</figcaption>
    </figure>
  )
}

/** D1/T8: `/api/health`'s `tokenConfigured` -- `null` while still loading (kept hidden until known, never flashing then hiding). */
function useTokenConfigured(): boolean | null {
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled) return
        if (body && typeof body === 'object' && 'tokenConfigured' in body) {
          setTokenConfigured(Boolean((body as { tokenConfigured: unknown }).tokenConfigured))
        }
      })
      .catch(() => {
        // Health check failing is never fatal -- LIVE_EXAMPLES just stays hidden, same as "not configured".
      })
    return () => {
      cancelled = true
    }
  }, [])

  return tokenConfigured
}

/**
 * The landing page: brand, pitch, the repo input (owner/repo or a full
 * GitHub URL), example chips, a real hero render, and credit links (P10).
 */
export function LandingPage() {
  useDocumentTitle('Micelio — every repository grows a mycelium galaxy')
  const [, navigate] = useLocation()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const tokenConfigured = useTokenConfigured()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const identity = parseRepoInput(value)
    if (!identity) {
      setError('Enter a GitHub repository as "owner/repo" or a full github.com URL.')
      return
    }
    setError(null)
    navigate(buildRepoPath(identity))
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: ui.bg,
        color: ui.text,
        fontFamily: ui.fontBody,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: ui.space(8),
          padding: ui.space(6),
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: ui.space(3), maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '2.4rem', fontWeight: 600 }}>Micelio</h1>
          <p style={{ margin: 0, color: ui.textMuted, fontSize: '1.05rem' }}>Every repository grows a mycelium galaxy.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: ui.space(2), marginTop: ui.space(3) }}>
            <div style={{ display: 'flex', gap: ui.space(2) }}>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="owner/repo or a GitHub URL"
                aria-label="GitHub repository"
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'repo-input-error' : undefined}
                style={{
                  flex: 1,
                  fontFamily: ui.fontBody,
                  fontSize: '0.95rem',
                  padding: `${ui.space(3)} ${ui.space(3)}`,
                  borderRadius: ui.space(2),
                  border: `1px solid ${ui.panelBorder}`,
                  background: ui.panelBg,
                  color: ui.text,
                }}
              />
              <button
                type="submit"
                style={{
                  fontFamily: ui.fontBody,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  padding: `${ui.space(3)} ${ui.space(5)}`,
                  borderRadius: ui.space(2),
                  border: 'none',
                  background: ui.accent,
                  color: '#1a1206',
                  cursor: 'pointer',
                }}
              >
                Grow it
              </button>
            </div>
            {error && (
              <p id="repo-input-error" role="alert" style={{ margin: 0, color: '#e08a8a', fontSize: '0.82rem', textAlign: 'left' }}>
                {error}
              </p>
            )}
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space(2), marginTop: ui.space(2) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space(1) }}>
              <span style={{ fontSize: '0.72rem', color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Instant samples · no token needed
              </span>
              <div style={{ display: 'flex', gap: ui.space(2), flexWrap: 'wrap', justifyContent: 'center' }}>
                {INSTANT_SAMPLES.map((example) => (
                  <ExampleChip key={`${example.owner}/${example.repo}`} {...example} />
                ))}
              </div>
            </div>
            {tokenConfigured && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space(1) }}>
                <span style={{ fontSize: '0.72rem', color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  More examples
                </span>
                <div style={{ display: 'flex', gap: ui.space(2), flexWrap: 'wrap', justifyContent: 'center' }}>
                  {LIVE_EXAMPLES.map((example) => (
                    <ExampleChip key={`${example.owner}/${example.repo}`} {...example} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Hero />
      </main>

      <footer
        style={{
          padding: ui.space(4),
          textAlign: 'center',
          fontSize: '0.78rem',
          color: ui.textMuted,
        }}
      >
        Built by{' '}
        <a href="https://github.com/TanisJam" target="_blank" rel="noopener noreferrer" style={{ color: ui.accent }}>
          TanisJam
        </a>{' '}
        ·{' '}
        <a href="https://mnr.ar" target="_blank" rel="noopener noreferrer" style={{ color: ui.accent }}>
          mnr.ar
        </a>
      </footer>
    </div>
  )
}
