#!/usr/bin/env tsx
/**
 * Visual QA harness: boots the Vite dev server, drives it with a
 * software-rendered (SwiftShader) headless Chromium so WebGL works without a
 * GPU, and saves desktop/mobile screenshots -- the mycelium network viewer at
 * a few growth/selection states for BOTH bundled fixtures, the landing page,
 * and a couple of product states -- into `.shots/` (gitignored). Fails
 * (non-zero exit) if the page logs any console error. Run with: `pnpm shot`.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const SHOTS_DIR = path.resolve(import.meta.dirname, '../.shots')

interface Viewport {
  name: string
  width: number
  height: number
}

const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

/**
 * Real network element ids from each bundled fixture's deterministic
 * `buildNetwork(snapshot, { layout: 'colony' })` output (`hypha-pr<N>` for a
 * merged/closed PR hypha, `mushroom-<tag>` for a release) -- stable across
 * runs since both the fixture and the model are deterministic. Found via a
 * throwaway inspection script, not guessed.
 *
 * Deliberately the fixtures' OWN highest-commit-count merged/closed PR (a
 * substantial one), not just "the first PR found" -- a real M3b visual-QA
 * finding: the colony layout's hypha length is work-driven (M2d), so a
 * tiny one-commit PR draws as a filament only a few screen pixels long
 * regardless of how bright/wide selection makes it. The original ids here
 * (PR #1 for valtio, PR #645 for express -- both ~1-commit PRs) made the
 * selection highlight genuinely hard to verify from a full-disc screenshot;
 * confirmed via a throwaway debug screenshot that the exact same selection
 * shader reads as unmistakably bright on a substantial (100+-commit) PR.
 */
interface FixtureIds {
  mergedHyphaId: string
  closedHyphaId: string
  mushroomId: string
}

interface Fixture {
  name: string
  path: string
  ids: FixtureIds
}

const FIXTURES: Fixture[] = [
  {
    name: 'valtio',
    // #965 (170 commits): "New implementation of proxyMap and proxySet..."
    // #962 (77 commits, closed): "Keyed collections"
    path: '/pmndrs/valtio',
    ids: { mergedHyphaId: 'hypha-pr965', closedHyphaId: 'hypha-pr962', mushroomId: 'mushroom-v1.0.0' },
  },
  {
    name: 'express',
    // #2554 (504 commits): "Release 4.12"
    // #5139 (37 commits, closed): "[feature] send blob response"
    path: '/expressjs/express',
    ids: { mergedHyphaId: 'hypha-pr2554', closedHyphaId: 'hypha-pr5139', mushroomId: 'mushroom-3.5.3' },
  },
]

interface Shot {
  name: string
  /** The route to visit, relative to the dev server root. */
  path: string
}

function fixtureShots(fixture: Fixture): Shot[] {
  const { path: base, ids } = fixture
  return [
    // `?t=1` pins the growth cursor to fully-grown instead of animating, for deterministic visual QA.
    { name: `${fixture.name}-end`, path: `${base}?t=1` },
    { name: `${fixture.name}-mid`, path: `${base}?t=0.5` },
    { name: `${fixture.name}-selected-merged`, path: `${base}?t=1&sel=${ids.mergedHyphaId}` },
    { name: `${fixture.name}-selected-closed`, path: `${base}?t=1&sel=${ids.closedHyphaId}` },
    // A selected mushroom (M3b): exercises the release-ring reveal
    // (`SoilDisc`'s `ringRadius`) and lets visual QA check the mushroom's
    // own detail-panel fields alongside its 3D glow/silhouette.
    { name: `${fixture.name}-selected-mushroom`, path: `${base}?t=1&sel=${ids.mushroomId}` },
  ]
}

const SHOTS: Shot[] = [
  { name: 'landing', path: '/' },
  ...FIXTURES.flatMap(fixtureShots),
  // Product states (P6), both reachable fully offline/deterministically:
  // a real, non-fixture repo with no GITHUB_TOKEN configured always hits
  // `token_required`; a single-segment path never matches `/:owner/:repo`,
  // so it always falls through to the router's 404.
  { name: 'state-token-required', path: '/facebook/react' },
  { name: 'state-not-found', path: '/this-page-does-not-exist' },
]

async function main(): Promise<void> {
  await mkdir(SHOTS_DIR, { recursive: true })

  const server = await createServer({ server: { port: 0, strictPort: false } })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite dev server did not report a URL')
  console.log(`Dev server up at ${baseUrl}`)

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })

  let hadErrors = false

  try {
    for (const viewport of VIEWPORTS) {
      for (const shot of SHOTS) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
        const consoleErrors: string[] = []
        page.on('console', (msg) => {
          if (msg.type() !== 'error') return
          // Chromium's devtools auto-logs this for every non-2xx
          // fetch/XHR response -- expected noise, not an app bug, when a
          // shot deliberately exercises a product error state (e.g. the
          // `token_required` 503 for a non-fixture repo with no
          // GITHUB_TOKEN configured). The app's own error handling (which
          // *is* covered -- see the rendered state screens) never logs
          // via console.error for this.
          if (msg.text().startsWith('Failed to load resource: the server responded with a status of')) return
          consoleErrors.push(msg.text())
        })
        page.on('pageerror', (err) => consoleErrors.push(String(err)))

        const url = new URL(shot.path, baseUrl)
        await page.goto(url.toString(), { waitUntil: 'networkidle' })
        // Let the canvas mount, the WebGL context initialize, postprocessing
        // compile and a few frames render (growth/bloom settle) before capturing.
        await page.waitForTimeout(2200)

        const fileName = `${viewport.name}-${shot.name}.png`
        const filePath = path.join(SHOTS_DIR, fileName)
        await page.screenshot({ path: filePath })
        console.log(`Saved ${filePath}`)

        if (consoleErrors.length > 0) {
          hadErrors = true
          console.error(`Console errors on ${fileName}:`)
          for (const err of consoleErrors) console.error(`  ${err}`)
        }

        await page.close()
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }

  if (hadErrors) {
    console.error('Screenshot run had console errors -- see above.')
    process.exitCode = 1
  } else {
    console.log('No console errors across any screenshot.')
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
