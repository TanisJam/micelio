import type { HyphaDraft } from './topology'

/**
 * Author metadata (M2c originally used this for LAYOUT -- angular sectors;
 * M2d's rewrite removes that: angle is now decided purely by gap-filling
 * against real growth, not by contributor. Per the M2d task brief ("Keep
 * sector/author only as optional color metadata (per-author hue index) --
 * not layout"), this module now only ranks contributors deterministically so
 * a future renderer can pick a stable per-author hue; `colonyLayout.ts` does
 * not import anything from here. Pure, no React/three/fetch.
 */

const COMMUNITY_KEY = 'community'
/** How many individual contributors get their own hue before the rest share one "community" hue -- kept from M2c's tuning. */
export const MAX_AUTHOR_HUES = 20

export function authorKeyOf(login: string | null): string {
  return login ?? COMMUNITY_KEY
}

/** The color-metadata key a given author (or `null` for an unattributed contributor) actually renders under -- their own if they made the cut, `'community'` otherwise. */
export function resolveAuthorHueKey(login: string | null, hueIndexByAuthor: Map<string, number>): string {
  const key = authorKeyOf(login)
  return hueIndexByAuthor.has(key) ? key : COMMUNITY_KEY
}

/**
 * Ranks every real contributor by merged-PR count (ties broken by earliest
 * real contribution, then key), and assigns the top `MAX_AUTHOR_HUES` a
 * stable index `0..MAX_AUTHOR_HUES-1` -- deterministic for a fixed hypha
 * list. Everyone else (including a zero-merged-PR contributor) maps to the
 * always-present `'community'` key at index `MAX_AUTHOR_HUES`. A renderer can
 * turn an index into a hue however it likes (e.g. `index * goldenAngle`);
 * this module only owns the ranking, not the color itself.
 */
export function buildAuthorHueIndex(hyphae: HyphaDraft[]): Map<string, number> {
  const mergedCountByAuthor = new Map<string, number>()
  const firstContributionByAuthor = new Map<string, number>()
  for (const draft of hyphae) {
    const key = authorKeyOf(draft.author.login)
    if (draft.kind === 'merged') mergedCountByAuthor.set(key, (mergedCountByAuthor.get(key) ?? 0) + 1)
    const existingFirst = firstContributionByAuthor.get(key)
    if (existingFirst === undefined || draft.splitTime < existingFirst) firstContributionByAuthor.set(key, draft.splitTime)
  }

  const ranked = [...mergedCountByAuthor.entries()]
    .filter(([key]) => key !== COMMUNITY_KEY)
    .sort(([keyA, countA], [keyB, countB]) => {
      if (countA !== countB) return countB - countA
      const firstA = firstContributionByAuthor.get(keyA) ?? 0
      const firstB = firstContributionByAuthor.get(keyB) ?? 0
      if (firstA !== firstB) return firstA - firstB
      return keyA.localeCompare(keyB)
    })
    .slice(0, MAX_AUTHOR_HUES)

  const result = new Map<string, number>()
  ranked.forEach(([key], index) => result.set(key, index))
  result.set(COMMUNITY_KEY, MAX_AUTHOR_HUES)
  return result
}
