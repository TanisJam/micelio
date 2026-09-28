#!/usr/bin/env tsx
/**
 * Generates a bundled fixture snapshot for a known `owner/repo`, using a
 * real GITHUB_TOKEN. Run with: `pnpm fixture owner/repo`.
 *
 * The fixture lets the app demo offline / without a token: `getRepoSnapshot`
 * falls back to these bundled snapshots when GITHUB_TOKEN is not set.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchRepoSnapshotFromGitHub } from '../src/adapters/github/fetchRepoSnapshot.ts'

async function main(): Promise<void> {
  const arg = process.argv[2]
  if (!arg || !arg.includes('/')) {
    console.error('Usage: pnpm fixture <owner>/<repo>')
    process.exitCode = 1
    return
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN is required to generate a fixture (export it in your shell only).')
    process.exitCode = 1
    return
  }

  const [owner, repo] = arg.split('/', 2)
  if (!owner || !repo) {
    console.error('Usage: pnpm fixture <owner>/<repo>')
    process.exitCode = 1
    return
  }
  console.log(`Fetching ${owner}/${repo} from GitHub...`)
  const snapshot = await fetchRepoSnapshotFromGitHub(owner, repo, token)

  const fileName = `${owner.toLowerCase()}-${repo.toLowerCase()}.json`
  const outPath = path.resolve(import.meta.dirname, '../src/server/fixtures', fileName)
  const json = JSON.stringify(snapshot, null, 2)
  await writeFile(outPath, json, 'utf-8')

  const sizeKb = Buffer.byteLength(json, 'utf-8') / 1024
  console.log(`Wrote ${outPath} (${sizeKb.toFixed(1)} KB)`)
  console.log(
    `Merged PRs: ${snapshot.mergedPullRequests.length}, releases: ${snapshot.releases.length}, ` +
      `open PRs: ${snapshot.openPullRequests.length}, branches: ${snapshot.liveBranches.length}, ` +
      `direct commits: ${snapshot.directCommits.length}`,
  )
  console.log(`Remember to register "${owner.toLowerCase()}/${repo.toLowerCase()}" in src/server/fixtures/index.ts`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
