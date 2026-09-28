import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { RepoSnapshot } from '../domain/repo.ts'

interface CacheEntry {
  value: RepoSnapshot
  expiresAt: number
}

/**
 * In-memory (always) + on-disk (best-effort) TTL cache for repo snapshots.
 * The on-disk layer is for local dev convenience across server restarts; it
 * is optional and every disk operation fails silently (falls back to
 * in-memory-only), so this is also safe on read-only serverless filesystems.
 */
export class SnapshotCache {
  private readonly memory = new Map<string, CacheEntry>()

  constructor(
    private readonly ttlMs: number,
    private readonly diskDir: string | null,
  ) {}

  private key(owner: string, repo: string): string {
    return `${owner.toLowerCase()}__${repo.toLowerCase()}`
  }

  async get(owner: string, repo: string): Promise<RepoSnapshot | undefined> {
    const key = this.key(owner, repo)
    const inMemory = this.memory.get(key)
    if (inMemory && inMemory.expiresAt > Date.now()) {
      return inMemory.value
    }

    if (!this.diskDir) return undefined

    try {
      const filePath = path.join(this.diskDir, `${key}.json`)
      const stat = await fs.stat(filePath)
      if (Date.now() - stat.mtimeMs > this.ttlMs) {
        return undefined
      }
      const raw = await fs.readFile(filePath, 'utf-8')
      const value = JSON.parse(raw) as RepoSnapshot
      this.memory.set(key, { value, expiresAt: Date.now() + this.ttlMs })
      return value
    } catch {
      return undefined
    }
  }

  async set(owner: string, repo: string, value: RepoSnapshot): Promise<void> {
    const key = this.key(owner, repo)
    this.memory.set(key, { value, expiresAt: Date.now() + this.ttlMs })

    if (!this.diskDir) return

    try {
      await fs.mkdir(this.diskDir, { recursive: true })
      await fs.writeFile(path.join(this.diskDir, `${key}.json`), JSON.stringify(value))
    } catch {
      // Best effort only (e.g. read-only filesystem in production).
    }
  }
}
