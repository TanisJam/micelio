#!/usr/bin/env node
/**
 * M4: generates real-render hero images from the actual mycelium colony
 * scene (`expressjs/express`, fully grown), replacing the earlier
 * tree-branded placeholder OG card (`generate-og-placeholder.mjs`, removed)
 * and the landing page's abstract animated SVG placeholder:
 *
 *   - `public/og.png` (1200x630, <=300kB): the OG/Twitter card image.
 *   - `public/hero.png` (<=250kB): the landing page's real hero image.
 *   - `docs/screenshot.png` (<=400kB): the README's real screenshot.
 *
 * Reuses `scripts/shot.ts`'s dev-server + SwiftShader-headless-Chromium
 * approach. Run with `pnpm hero-images` (or `pnpm tsx
 * scripts/generate-hero-images.mjs`) -- not part of the regular `pnpm shot`
 * QA loop since these are committed assets, not gitignored debug output.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')

async function main() {
  const server = await createServer({ server: { port: 0, strictPort: false } })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite dev server did not report a URL')

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })

  try {
    // A wide desktop viewport, fully-grown colony, no selection -- the
    // cleanest full-galaxy read. `expressjs/express` has a richer, denser
    // colony than the tiny bundled `valtio` fixture.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(new URL('/expressjs/express?t=1', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)

    // docs/screenshot.png: the full viewer chrome + galaxy, for the README.
    await mkdir(path.join(ROOT, 'docs'), { recursive: true })
    const screenshotPath = path.join(ROOT, 'docs/screenshot.png')
    const screenshotBuffer = await page.screenshot({ path: screenshotPath })
    console.log(`Saved ${screenshotPath} (${(screenshotBuffer.length / 1024).toFixed(1)} kB)`)

    // public/og.png (1200x630) and public/hero.png: just the galaxy canvas,
    // cropped -- no header/legend/scrubber chrome, so it reads as a clean
    // hero image rather than a UI screenshot.
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Could not locate the scene canvas')

    const ogWidth = 1200
    const ogHeight = 630
    const ogClip = {
      x: box.x + Math.max(0, (box.width - ogWidth) / 2),
      y: box.y + Math.max(0, (box.height - ogHeight) / 2),
      width: Math.min(ogWidth, box.width),
      height: Math.min(ogHeight, box.height),
    }
    await mkdir(path.join(ROOT, 'public'), { recursive: true })
    const ogPath = path.join(ROOT, 'public/og.png')
    const ogBuffer = await page.screenshot({ path: ogPath, clip: ogClip })
    console.log(`Saved ${ogPath} (${(ogBuffer.length / 1024).toFixed(1)} kB)`)

    const heroWidth = Math.min(900, box.width)
    const heroHeight = Math.min(700, box.height)
    const heroClip = {
      x: box.x + Math.max(0, (box.width - heroWidth) / 2),
      y: box.y + Math.max(0, (box.height - heroHeight) / 2),
      width: heroWidth,
      height: heroHeight,
    }
    const heroPath = path.join(ROOT, 'public/hero.png')
    const heroBuffer = await page.screenshot({ path: heroPath, clip: heroClip })
    console.log(`Saved ${heroPath} (${(heroBuffer.length / 1024).toFixed(1)} kB)`)

    await page.close()
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
