#!/usr/bin/env node
/**
 * Generates a small, compressed placeholder OG image (`public/og.png`):
 * a simple branded gradient card with the "Huerto" wordmark and pitch.
 * Deliberately not a screenshot of the 3D scene -- the visual metaphor is
 * being redesigned, so a real hero render is left for a later pass (see
 * `odd/tasks/huerto-mvp.md`). Run with: `node scripts/generate-og-placeholder.mjs`.
 */
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body { margin:0; width:1200px; height:630px; }
  body {
    background: linear-gradient(160deg, #1c150d 0%, #3a2814 55%, #5c3d1c 100%);
    display: flex; align-items: center; justify-content: center;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .card { text-align: center; color: #fbf3e7; }
  h1 { font-size: 120px; margin: 0; font-weight: 700; letter-spacing: 2px; }
  p { font-family: system-ui, sans-serif; font-size: 34px; margin: 18px 0 0; color: #f0d9b8; }
  .mark { margin-bottom: 12px; }
</style></head>
<body>
  <div class="card">
    <svg class="mark" width="96" height="96" viewBox="0 0 32 32">
      <g fill="none" stroke="#d9a441" stroke-width="1.3" stroke-linecap="round">
        <line x1="16" y1="16" x2="7" y2="10"/><line x1="16" y1="16" x2="25" y2="10"/>
        <line x1="16" y1="16" x2="9" y2="24"/><line x1="16" y1="16" x2="23" y2="24"/>
        <line x1="16" y1="16" x2="16" y2="5"/>
      </g>
      <circle cx="16" cy="16" r="4" fill="#ff6a12"/>
      <circle cx="7" cy="10" r="2.2" fill="#d9a441"/><circle cx="25" cy="10" r="2.2" fill="#d9a441"/>
      <circle cx="9" cy="24" r="2.2" fill="#d9a441"/><circle cx="23" cy="24" r="2.2" fill="#d9a441"/>
      <circle cx="16" cy="5" r="2.2" fill="#d9a441"/>
    </svg>
    <h1>Huerto</h1>
    <p>Every repository grows a living history.</p>
  </div>
</body></html>`

const outPath = path.resolve(import.meta.dirname, '../public/og.png')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
const buffer = await page.screenshot({ type: 'png' })
await writeFile(outPath, buffer)
await browser.close()

console.log(`Saved ${outPath} (${(buffer.length / 1024).toFixed(1)} kB)`)
