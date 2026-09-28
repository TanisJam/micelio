#!/usr/bin/env tsx
/**
 * Visual QA harness: boots the Vite dev server, drives it with a
 * software-rendered (SwiftShader) headless Chromium so WebGL works without a
 * GPU, and saves desktop/mobile screenshots -- the 3D viewer at a few growth
 * states, the landing page, and a couple of product states -- into
 * `.shots/` (gitignored). Fails (non-zero exit) if the page logs any
 * console error. Run with: `pnpm shot`.
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

// A twig id from the bundled fixture (`pmndrs/valtio`), stable across runs
// since the fixture and the deterministic tree model never change.
const SELECTED_PR_TWIG_ID = 'twig-pr1'
const FIXTURE_PATH = '/pmndrs/valtio'

interface Shot {
  name: string
  /** The route to visit, relative to the dev server root. */
  path: string
}

const SHOTS: Shot[] = [
  { name: 'landing', path: '/' },
  // `?t=1` pins the growth cursor to fully-grown instead of animating, for
  // deterministic visual QA.
  { name: 'end', path: `${FIXTURE_PATH}?t=1` },
  { name: 'mid', path: `${FIXTURE_PATH}?t=0.5` },
  { name: 'end-selected', path: `${FIXTURE_PATH}?t=1&sel=${SELECTED_PR_TWIG_ID}` },
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
        // Let the canvas mount, the WebGL context initialize and a few
        // frames render (shadows/instances settle) before capturing.
        await page.waitForTimeout(1800)

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
