/**
 * Pure nearest-segment/point picking, no three.js, over a precomputed XZ
 * spatial grid instead of a linear O(n) scan over every hypha
 * segment/hair/mushroom/fusion. `queryNearest` is the original 2D (XZ-plane)
 * query. Galaxy-3d: the colony is now volumetric (a bulge up to ~1 world
 * unit thick), so projecting the pointer onto y=0 would miss elevated
 * strands by up to a world unit of parallax at an oblique camera --
 * `queryNearestAlongRay` walks the pointer ray through the colony's height
 * slab instead and measures true 3D ray-to-segment distance.
 */

export interface PickTarget {
  /** The element id this target resolves to on click/hover (a hypha, node, tip or mushroom id -- never a hair, which isn't independently selectable). */
  id: string
  /** Segment start. Equal to `x2`/`z2` for a point target (a mushroom/fusion/tip/spore). */
  x1: number
  /** Segment start height (default 0). */
  y1?: number
  z1: number
  x2: number
  /** Segment end height (default 0). */
  y2?: number
  z2: number
  /**
   * The epoch-ms growth time at which this target becomes fully visible
   * (matches `growthMaterial.ts`'s per-fragment `vBirthTime > uCurrentTime`
   * discard -- the later of a segment's two endpoint times, so the whole
   * target is only pickable once no part of it is still hidden). A target
   * with `visibleAt > currentTime` must never be returned by `queryNearest`
   * (A2/T8: "no clickable invisible hyphae during growth").
   */
  visibleAt: number
}

interface GridCell {
  targets: PickTarget[]
}

export interface PickGrid {
  cellSize: number
  cells: Map<string, GridCell>
}

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`
}

function cellCoord(value: number, cellSize: number): number {
  return Math.floor(value / cellSize)
}

/** Squared distance from point `(px, pz)` to segment `(x1,z1)-(x2,z2)`. */
function distanceSqToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1
  const dz = z2 - z1
  const lengthSq = dx * dx + dz * dz
  if (lengthSq < 1e-12) {
    const ex = px - x1
    const ez = pz - z1
    return ex * ex + ez * ez
  }
  const t = Math.min(1, Math.max(0, ((px - x1) * dx + (pz - z1) * dz) / lengthSq))
  const cx = x1 + dx * t
  const cz = z1 + dz * t
  const ex = px - cx
  const ez = pz - cz
  return ex * ex + ez * ez
}

/**
 * Builds a uniform-grid spatial index over `targets`, bucketing each by the
 * cells its bounding box spans so a nearest-neighbor query only needs to
 * scan a small local neighborhood instead of every target.
 */
export function buildPickGrid(targets: PickTarget[], cellSize: number): PickGrid {
  const safeCellSize = cellSize > 0 ? cellSize : 1
  const cells = new Map<string, GridCell>()

  for (const target of targets) {
    const minX = Math.min(target.x1, target.x2)
    const maxX = Math.max(target.x1, target.x2)
    const minZ = Math.min(target.z1, target.z2)
    const maxZ = Math.max(target.z1, target.z2)
    const minCx = cellCoord(minX, safeCellSize)
    const maxCx = cellCoord(maxX, safeCellSize)
    const minCz = cellCoord(minZ, safeCellSize)
    const maxCz = cellCoord(maxZ, safeCellSize)

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = cellKey(cx, cz)
        let cell = cells.get(key)
        if (!cell) {
          cell = { targets: [] }
          cells.set(key, cell)
        }
        cell.targets.push(target)
      }
    }
  }

  return { cellSize: safeCellSize, cells }
}

/**
 * Finds the nearest target to `(x, z)` within `tolerance` world units, or
 * `null` if nothing is close enough. Only scans the grid cells overlapping a
 * `tolerance`-sized box around the query point (plus their immediate
 * neighbors, since a target's nearest point may sit in an adjacent cell to
 * where the query itself falls).
 *
 * `currentTime` (default `Infinity`, i.e. no filtering) excludes any target
 * whose `visibleAt` is still in the future -- so picking during growth
 * replay only ever resolves to something actually drawn on screen right
 * now, never a hypha/node/mushroom that hasn't grown in yet (A2/T8).
 */
export function queryNearest(
  grid: PickGrid,
  x: number,
  z: number,
  tolerance: number,
  currentTime: number = Infinity,
): { id: string; distance: number } | null {
  const toleranceSq = tolerance * tolerance
  const cx = cellCoord(x, grid.cellSize)
  const cz = cellCoord(z, grid.cellSize)
  const cellRadius = Math.max(1, Math.ceil(tolerance / grid.cellSize))

  let bestId: string | null = null
  let bestDistanceSq = Infinity
  const seen = new Set<PickTarget>()

  for (let dx = -cellRadius; dx <= cellRadius; dx++) {
    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
      const cell = grid.cells.get(cellKey(cx + dx, cz + dz))
      if (!cell) continue
      for (const target of cell.targets) {
        if (seen.has(target)) continue
        seen.add(target)
        if (target.visibleAt > currentTime) continue
        const distanceSq = distanceSqToSegment(x, z, target.x1, target.z1, target.x2, target.z2)
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq
          bestId = target.id
        }
      }
    }
  }

  if (bestId === null || bestDistanceSq > toleranceSq) return null
  return { id: bestId, distance: Math.sqrt(bestDistanceSq) }
}

export interface PickRay {
  origin: { x: number; y: number; z: number }
  /** Unit-length direction. */
  direction: { x: number; y: number; z: number }
}

/** Squared distance from a ray (origin `o`, unit dir `d`, `s >= 0`) to the segment `a`-`b`. */
export function raySegmentDistanceSq(ray: PickRay, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const d = ray.direction
  const o = ray.origin
  const ex = b.x - a.x
  const ey = b.y - a.y
  const ez = b.z - a.z
  const wx = o.x - a.x
  const wy = o.y - a.y
  const wz = o.z - a.z
  const dd = d.x * d.x + d.y * d.y + d.z * d.z
  const de = d.x * ex + d.y * ey + d.z * ez
  const ee = ex * ex + ey * ey + ez * ez
  const dw = d.x * wx + d.y * wy + d.z * wz
  const ew = ex * wx + ey * wy + ez * wz
  const denom = dd * ee - de * de
  // f(t) = min over s >= 0 of |ray(s) - seg(t)|^2 is convex in t, so its
  // minimum is at one of: the line-line solution, the ray-origin-to-segment
  // solution, or a segment endpoint -- evaluate all and keep the best.
  const at = (tRaw: number): number => {
    const t = Math.min(1, Math.max(0, tRaw))
    const s = Math.max(0, (de * t - dw) / dd)
    const px = o.x + d.x * s - (a.x + ex * t)
    const py = o.y + d.y * s - (a.y + ey * t)
    const pz = o.z + d.z * s - (a.z + ez * t)
    return px * px + py * py + pz * pz
  }
  let best = Math.min(at(0), at(1))
  if (ee > 1e-12) {
    if (denom > 1e-12) best = Math.min(best, at((dd * ew - de * dw) / denom))
    best = Math.min(best, at(ew / ee))
  }
  return best
}

/**
 * Galaxy-3d picking: the nearest target (by true 3D distance to the pointer
 * ray) within `tolerance`, considering only the part of the ray inside the
 * colony's cylinder (`bounds`: `|y| <= halfHeight`, disc radius <= `radius`). Walks
 * that clipped ray in `cellSize` steps through the XZ grid, so cost stays
 * proportional to the ray's footprint, not the target count. `currentTime`
 * filters not-yet-grown targets exactly like `queryNearest`.
 */
export function queryNearestAlongRay(
  grid: PickGrid,
  ray: PickRay,
  bounds: { halfHeight: number; radius: number },
  tolerance: number,
  currentTime: number = Infinity,
): { id: string; distance: number } | null {
  const o = ray.origin
  const d = ray.direction
  const slab = Math.max(0, bounds.halfHeight) + tolerance
  const reach = Math.max(0, bounds.radius) + tolerance
  // Clip the ray to the colony's cylinder: |xz| <= reach ...
  const qa = d.x * d.x + d.z * d.z
  const qb = 2 * (o.x * d.x + o.z * d.z)
  const qc = o.x * o.x + o.z * o.z - reach * reach
  let sMin = 0
  let sMax: number
  if (qa < 1e-12) {
    if (qc > 0) return null
    sMax = Math.abs(d.y) > 1e-9 ? (Math.abs(o.y) + slab) / Math.abs(d.y) : 0
  } else {
    const disc = qb * qb - 4 * qa * qc
    if (disc < 0) return null
    const root = Math.sqrt(disc)
    sMin = Math.max(0, (-qb - root) / (2 * qa))
    sMax = (-qb + root) / (2 * qa)
  }
  // ... and to the height slab |y| <= slab.
  if (Math.abs(d.y) < 1e-9) {
    if (Math.abs(o.y) > slab) return null
  } else {
    const s1 = (-slab - o.y) / d.y
    const s2 = (slab - o.y) / d.y
    sMin = Math.max(sMin, Math.min(s1, s2))
    sMax = Math.min(sMax, Math.max(s1, s2))
  }
  if (sMax < sMin) return null

  const toleranceSq = tolerance * tolerance
  const cellRadius = Math.max(1, Math.ceil(tolerance / grid.cellSize))
  const horizontal = Math.hypot(d.x, d.z)
  const step = horizontal > 1e-9 ? grid.cellSize / horizontal : sMax - sMin
  const visitedCells = new Set<string>()
  const seen = new Set<PickTarget>()
  let bestId: string | null = null
  let bestDistanceSq = Infinity

  for (let s = sMin; s <= sMax + step; s += Math.max(step, 1e-6)) {
    const clamped = Math.min(s, sMax)
    const cx = cellCoord(o.x + d.x * clamped, grid.cellSize)
    const cz = cellCoord(o.z + d.z * clamped, grid.cellSize)
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = cellKey(cx + dx, cz + dz)
        if (visitedCells.has(key)) continue
        visitedCells.add(key)
        const cell = grid.cells.get(key)
        if (!cell) continue
        for (const target of cell.targets) {
          if (seen.has(target)) continue
          seen.add(target)
          if (target.visibleAt > currentTime) continue
          const distanceSq = raySegmentDistanceSq(
            ray,
            { x: target.x1, y: target.y1 ?? 0, z: target.z1 },
            { x: target.x2, y: target.y2 ?? 0, z: target.z2 },
          )
          if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq
            bestId = target.id
          }
        }
      }
    }
    if (clamped >= sMax) break
  }

  if (bestId === null || bestDistanceSq > toleranceSq) return null
  return { id: bestId, distance: Math.sqrt(bestDistanceSq) }
}
