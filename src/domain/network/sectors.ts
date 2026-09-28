import { createPrng, randJitter } from '../tree/prng'
import type { HyphaDraft } from './topology'

/**
 * Colony-layout-only (M2c): assigns every contributor an angular sector of
 * the disc, proportional to their real merged-PR count, ordered stably by
 * first contribution time -- "angle = contributor" from the task brief.
 * Long-tail authors (anyone not in the top `MAX_AUTHOR_SECTORS` by merged-PR
 * count, or with zero merged PRs) share one "community" sector so the disc
 * never fragments into hundreds of imperceptibly thin slices. Pure, no
 * React/three/fetch.
 */

const MAX_AUTHOR_SECTORS = 20
const COMMUNITY_KEY = 'community'
/** A floor so the community sector is always visible even when its members merged nothing (only closed/open PRs). */
const MIN_SECTOR_WEIGHT = 0.6
/** A floor (radians) so no sector collapses to an imperceptible sliver after proportional sizing, applied via a two-pass floor-then-renormalize. */
const MIN_SECTOR_ANGLE = (Math.PI * 2) / 48
/** Per-item jitter inside its angular slot, seeded -- organic, not a rigid grid. */
const SLOT_ANGLE_JITTER_FRACTION = 0.18

export interface AuthorSector {
  authorKey: string
  angleStart: number
  angleWidth: number
  weight: number
}

export interface AngularSlot {
  /** Absolute angle (radians) this hypha grows toward. */
  angle: number
  sector: AuthorSector
}

interface AuthorAgg {
  key: string
  mergedCount: number
  firstContribution: number
}

export function authorKeyOf(login: string | null): string {
  return login ?? COMMUNITY_KEY
}

/** The sector a given author (or `null` for an unattributed contributor) actually renders in -- their own if they made the cut, `'community'` otherwise. */
export function resolveSectorKey(login: string | null, sectors: Map<string, AuthorSector>): string {
  const key = authorKeyOf(login)
  return sectors.has(key) ? key : COMMUNITY_KEY
}

/**
 * Greedy interval scheduling identical in spirit to `assignLanes` (layout.ts)
 * but producing a single angular lane track per author (no side split --
 * angular slots fan out within one sector, not two opposing bows).
 */
export function assignSlotsWithinGroup(items: { id: string; splitTime: number; endTime: number }[]): Map<string, { slot: number; slotCount: number }> {
  const sorted = [...items].sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))
  const laneEnds: number[] = []
  const slotById = new Map<string, number>()
  for (const item of sorted) {
    let laneIndex = laneEnds.findIndex((end) => end <= item.splitTime)
    if (laneIndex === -1) {
      laneIndex = laneEnds.length
      laneEnds.push(item.endTime)
    } else {
      laneEnds[laneIndex] = item.endTime
    }
    slotById.set(item.id, laneIndex)
  }
  const slotCount = Math.max(1, laneEnds.length)
  const result = new Map<string, { slot: number; slotCount: number }>()
  for (const [id, slot] of slotById) result.set(id, { slot, slotCount })
  return result
}

/**
 * Builds one sector per top contributor (by merged-PR count) plus one shared
 * "community" sector for everyone else, ordered around the circle by each
 * group's earliest real contribution time.
 */
export function buildAuthorSectors(hyphae: HyphaDraft[]): Map<string, AuthorSector> {
  const byAuthor = new Map<string, AuthorAgg>()
  for (const draft of hyphae) {
    const key = authorKeyOf(draft.author.login)
    const existing = byAuthor.get(key)
    const mergedDelta = draft.kind === 'merged' ? 1 : 0
    if (!existing) {
      byAuthor.set(key, { key, mergedCount: mergedDelta, firstContribution: draft.splitTime })
    } else {
      existing.mergedCount += mergedDelta
      existing.firstContribution = Math.min(existing.firstContribution, draft.splitTime)
    }
  }

  const all = [...byAuthor.values()]
  const ranked = [...all]
    .filter((a) => a.mergedCount > 0 && a.key !== COMMUNITY_KEY)
    .sort((a, b) => b.mergedCount - a.mergedCount || a.firstContribution - b.firstContribution || a.key.localeCompare(b.key))
  const topKeys = new Set(ranked.slice(0, MAX_AUTHOR_SECTORS).map((a) => a.key))

  const groups: { key: string; weight: number; firstContribution: number }[] = []
  let communityWeight = 0
  let communityFirst = Number.POSITIVE_INFINITY
  for (const author of all) {
    if (topKeys.has(author.key)) {
      groups.push({ key: author.key, weight: Math.max(author.mergedCount, MIN_SECTOR_WEIGHT), firstContribution: author.firstContribution })
    } else {
      communityWeight += author.mergedCount
      communityFirst = Math.min(communityFirst, author.firstContribution)
    }
  }
  // Always reserve a community sector, even when every currently-known
  // author made the top-N cut (so its weight/width would otherwise be 0):
  // `resolveSectorKey` falls back to `'community'` for any author outside
  // this build's own hypha population (e.g. a direct-commit-only author,
  // who never opened a PR and so was never counted above) -- that fallback
  // must always resolve to a real sector, never a dangling key.
  groups.push({
    key: COMMUNITY_KEY,
    weight: Math.max(communityWeight, MIN_SECTOR_WEIGHT),
    firstContribution: Number.isFinite(communityFirst) ? communityFirst : (all[0]?.firstContribution ?? 0),
  })

  // `groups` always has at least the community entry pushed above (even for
  // an empty/tiny repo with no hyphae at all -- it computes to one
  // full-circle sector, since it is then the only entry).
  groups.sort((a, b) => a.firstContribution - b.firstContribution || a.key.localeCompare(b.key))

  const totalWeight = groups.reduce((sum, g) => sum + g.weight, 0)
  const rawWidths = groups.map((g) => (g.weight / totalWeight) * Math.PI * 2)
  // Floor-then-renormalize: raise any sector below the minimum angle up to
  // it, then shrink every sector still above the floor proportionally so the
  // total stays exactly 2*pi.
  const floored = rawWidths.map((w) => Math.max(w, Math.min(MIN_SECTOR_ANGLE, (Math.PI * 2) / groups.length)))
  const flooredSum = floored.reduce((a, b) => a + b, 0)
  const scale = flooredSum > 0 ? (Math.PI * 2) / flooredSum : 1
  const widths = floored.map((w) => w * scale)

  const result = new Map<string, AuthorSector>()
  let cursor = 0
  groups.forEach((g, index) => {
    const width = widths[index]!
    result.set(g.key, { authorKey: g.key, angleStart: cursor, angleWidth: width, weight: g.weight })
    cursor += width
  })
  return result
}

/**
 * Assigns every hypha an absolute growth angle: its author's sector, spread
 * within that sector via time-ordered angular slot allocation (like
 * radial lanes, but angular) plus a small seeded jitter, so concurrent PRs
 * by the same author fan out instead of overlapping exactly.
 */
export function assignAngularSlots(hyphae: HyphaDraft[], sectors: Map<string, AuthorSector>, seed: string): Map<string, AngularSlot> {
  const bySector = new Map<string, HyphaDraft[]>()
  for (const draft of hyphae) {
    const key = resolveSectorKey(draft.author.login, sectors)
    const list = bySector.get(key) ?? []
    list.push(draft)
    bySector.set(key, list)
  }

  const prng = createPrng(`${seed}:network-colony-sectors`)
  const result = new Map<string, AngularSlot>()
  for (const [key, members] of bySector) {
    const sector = sectors.get(key)
    if (!sector) continue
    const slots = assignSlotsWithinGroup(members.map((m) => ({ id: m.id, splitTime: m.splitTime, endTime: m.endTime })))
    for (const member of members) {
      const { slot, slotCount } = slots.get(member.id)!
      const slotWidth = sector.angleWidth / slotCount
      const center = sector.angleStart + slotWidth * (slot + 0.5)
      const jitter = randJitter(prng, slotWidth * SLOT_ANGLE_JITTER_FRACTION)
      result.set(member.id, { angle: center + jitter, sector })
    }
  }
  return result
}
