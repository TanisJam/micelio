/**
 * Pure 2D (XZ-plane) nearest-segment/point picking, no three.js. The
 * mycelium network is nearly flat (see M3 brief), so hover/click resolves by
 * raycasting the pointer onto the soil plane (y ≈ 0, done in the R3F layer)
 * and then finding the nearest network element here, in a precomputed
 * spatial grid instead of a linear O(n) scan over every hypha
 * segment/hair/mushroom/fusion.
 */

export interface PickTarget {
  /** The element id this target resolves to on click/hover (a hypha, node, tip or mushroom id -- never a hair, which isn't independently selectable). */
  id: string
  /** Segment start. Equal to `x2`/`z2` for a point target (a mushroom/fusion/tip/spore). */
  x1: number
  z1: number
  x2: number
  z2: number
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
 */
export function queryNearest(grid: PickGrid, x: number, z: number, tolerance: number): { id: string; distance: number } | null {
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
