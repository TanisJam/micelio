#!/usr/bin/env tsx
/**
 * Dev-only visual QA for the M2 network (mycelium) layout, independent of
 * any rendering work (M3 doesn't exist yet): builds the deterministic
 * `NetworkModel` for both bundled fixtures and writes a top-down SVG (XZ
 * plane, matching the model's own "disc" layout) to `.shots/` (gitignored),
 * then rasterizes each to a PNG via headless Chromium (playwright, already
 * a devDependency -- no `rsvg-convert`/imagemagick available in this
 * environment) so it can be inspected with an image-viewing tool. Run with
 * `pnpm tsx scripts/network-svg.ts`.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { buildNetwork } from '../src/domain/network/buildNetwork.ts'
import type { Hair, Hypha, HyphaKind, Mushroom, NetworkModel, NetworkNode, Tip } from '../src/domain/network/types.ts'
import expressFixture from '../src/server/fixtures/expressjs-express.json' with { type: 'json' }
import valtioFixture from '../src/server/fixtures/pmndrs-valtio.json' with { type: 'json' }
import type { RepoSnapshot } from '../src/domain/repo.ts'

const SHOTS_DIR = path.resolve(import.meta.dirname, '../.shots')
const SIZE = 1400
const MARGIN = 40

const HYPHA_COLOR: Record<HyphaKind, string> = {
  main: '#e8fff2',
  merged: '#6ee7ff',
  closed: '#8a6b4f',
  open: '#ffe9a8',
  liveBranch: '#9fb3c8',
}

const HYPHA_WIDTH: Record<HyphaKind, number> = {
  main: 2.4,
  merged: 1.1,
  closed: 0.9,
  open: 1.1,
  liveBranch: 0.9,
}

function projectSvg(x: number, z: number, scale: number): [number, number] {
  return [SIZE / 2 + x * scale, SIZE / 2 + z * scale]
}

function polylinePoints(hypha: Hypha, scale: number): string {
  return hypha.points.map((p) => projectSvg(p.position.x, p.position.z, scale).join(',')).join(' ')
}

/** A short thin line from a hair's base to its tip -- fine mycelial texture, one per real commit node. */
function hairLine(hair: Hair, scale: number): string {
  const [x1, y1] = projectSvg(hair.position.x, hair.position.z, scale)
  const [x2, y2] = projectSvg(hair.position.x + hair.direction.x * hair.length, hair.position.z + hair.direction.z * hair.length, scale)
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`
}

function buildSvg(model: NetworkModel, title: string): string {
  const scale = (SIZE / 2 - MARGIN) / Math.max(model.bounds.radius, 0.1)
  const parts: string[] = []

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`)
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="#05070a" />`)

  // Reference rings every full spiral turn, to visually check "loops never
  // cross the next turn" and general disc balance/fill at a glance.
  for (let i = 1; i <= 6; i++) {
    const r = (model.bounds.radius * i) / 6
    parts.push(`<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${r * scale}" fill="none" stroke="#1a2230" stroke-width="1" />`)
  }

  // Hairs first (bottom layer): thin, low-opacity, additive-ish (mix-blend
  // "screen") so overlapping strands brighten exactly where the mycelium is
  // dense -- a cheap stand-in for the eventual selective-bloom glow (M3).
  parts.push('<g stroke="#7fd6c9" stroke-width="0.55" stroke-opacity="0.4" stroke-linecap="round" style="mix-blend-mode: screen">')
  for (const hair of model.hairs) parts.push(hairLine(hair, scale))
  parts.push('</g>')

  parts.push('<g style="mix-blend-mode: screen">')
  for (const hypha of model.hyphae) {
    if (hypha.points.length < 2) continue
    parts.push(
      `<polyline points="${polylinePoints(hypha, scale)}" fill="none" stroke="${HYPHA_COLOR[hypha.kind]}" stroke-width="${HYPHA_WIDTH[hypha.kind]}" stroke-opacity="${hypha.kind === 'main' ? 0.95 : 0.6}" />`,
    )
  }
  parts.push('</g>')

  const nodeSample: NetworkNode[] = model.nodes.filter((_, i) => i % 3 === 0) // thin out for legibility
  parts.push('<g style="mix-blend-mode: screen">')
  for (const node of nodeSample) {
    const [x, y] = projectSvg(node.position.x, node.position.z, scale)
    parts.push(`<circle cx="${x}" cy="${y}" r="${node.isMergePoint ? 2.2 : 1.1}" fill="${node.isMergePoint ? '#ffe9a8' : '#4fa8c9'}" fill-opacity="0.7" />`)
    if (node.isMergePoint) {
      // Fusion "knot": a small contrasting halo ring around a real merge
      // commit's own node -- backed by the same `isMergePoint` real data,
      // not a fabricated extra element.
      parts.push(`<circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="#ffe9a8" stroke-width="0.8" stroke-opacity="0.85" />`)
    }
  }
  parts.push('</g>')

  const mushrooms: Mushroom[] = model.mushrooms
  for (const mushroom of mushrooms) {
    const [x, y] = projectSvg(mushroom.position.x, mushroom.position.z, scale)
    parts.push(`<circle cx="${x}" cy="${y}" r="${2 + mushroom.scale * 3}" fill="#b9f5ff" fill-opacity="0.85" />`)
  }

  const tips: Tip[] = model.tips
  for (const tip of tips) {
    const [x, y] = projectSvg(tip.position.x, tip.position.z, scale)
    parts.push(`<circle cx="${x}" cy="${y}" r="3.2" fill="none" stroke="#ffe9a8" stroke-width="1.4" />`)
  }

  const [sx, sy] = projectSvg(model.spore.position.x, model.spore.position.z, scale)
  parts.push(`<circle cx="${sx}" cy="${sy}" r="5" fill="#ffffff" />`)

  parts.push(
    `<text x="16" y="28" fill="#e8fff2" font-family="monospace" font-size="18">${title} -- hyphae ${model.hyphae.length}, nodes ${model.nodes.length}, hairs ${model.hairs.length}, mushrooms ${model.mushrooms.length}, radius ${model.bounds.radius.toFixed(2)}</text>`,
  )
  parts.push('</svg>')
  return parts.join('\n')
}

async function main(): Promise<void> {
  await mkdir(SHOTS_DIR, { recursive: true })

  const fixtures: [string, RepoSnapshot][] = [
    ['pmndrs-valtio', valtioFixture as unknown as RepoSnapshot],
    ['expressjs-express', expressFixture as unknown as RepoSnapshot],
  ]

  const browser = await chromium.launch()
  try {
    for (const [name, snapshot] of fixtures) {
      const model = buildNetwork(snapshot)
      const svg = buildSvg(model, name)
      const svgPath = path.join(SHOTS_DIR, `network-${name}.svg`)
      await writeFile(svgPath, svg, 'utf-8')
      console.log(`Wrote ${svgPath}`)

      const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
      await page.goto(`file://${svgPath}`)
      const pngPath = path.join(SHOTS_DIR, `network-${name}.png`)
      await page.screenshot({ path: pngPath })
      console.log(`Wrote ${pngPath}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
