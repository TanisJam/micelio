#!/usr/bin/env tsx
/**
 * Visual QA harness: boots the Vite dev server, drives it with a
 * software-rendered (SwiftShader) headless Chromium so WebGL works without a
 * GPU, and saves desktop/mobile screenshots at growth-end and mid-growth
 * into `.shots/` (gitignored). Fails (non-zero exit) if the page logs any
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

interface GrowthState {
  name: string
  t: number
}

const GROWTH_STATES: GrowthState[] = [
  { name: 'end', t: 1 },
  { name: 'mid', t: 0.5 },
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
      for (const state of GROWTH_STATES) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
        const consoleErrors: string[] = []
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text())
        })
        page.on('pageerror', (err) => consoleErrors.push(String(err)))

        const url = new URL(baseUrl)
        url.searchParams.set('t', String(state.t))
        await page.goto(url.toString(), { waitUntil: 'networkidle' })
        // Let the canvas mount, the WebGL context initialize and a few
        // frames render (shadows/instances settle) before capturing.
        await page.waitForTimeout(1800)

        const fileName = `${viewport.name}-${state.name}.png`
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
