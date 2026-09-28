import type { TimeBounds } from '../tree/types'
import type { Vec3 } from '../tree/vector'

/**
 * The network (mycelium) model: a deterministic, pure-data layout derived
 * from a `RepoSnapshot`, mapping git's branch/merge DAG ~1:1 onto hyphae
 * that split off a parent and either fuse back (merged PR), dry out (closed
 * PR) or keep growing (open PR / live branch). No React, no three.js -- the
 * UI layer turns this into geometry (M3).
 *
 * Reuses `../tree/vector` (`Vec3`) and `../tree/timeBounds`
 * (`computeTimeBounds`/`TimeBounds`) rather than duplicating them: both are
 * metaphor-agnostic pure helpers, not tree-geometry-specific. When M4
 * removes the rest of `src/domain/tree/`, these two should move to a shared
 * top-level `src/domain/` location and this module's imports updated
 * accordingly (a small, mechanical follow-up, not attempted here to avoid
 * an unrelated blast radius during M1/M2).
 */

export type NetworkRefType = 'repo' | 'release' | 'pull_request' | 'commit' | 'branch'

/** Points back to the real GitHub data a network element represents. */
export interface NetworkRef {
  type: NetworkRefType
  /** Release tag, PR number (as string), commit oid, or branch name. */
  id: string
}

export type HyphaKind =
  | 'main'
  /** A merged PR: splits from its parent and fuses back at `mergedAt`. */
  | 'merged'
  /** A closed-unmerged PR: splits from its parent and dries out at `closedAt`. */
  | 'closed'
  /** An open PR: splits from its parent and keeps growing to "now". */
  | 'open'
  /** A live branch with no open PR: splits from its parent and keeps growing to "now". */
  | 'liveBranch'

export interface HyphaPoint {
  position: Vec3
  radius: number
  /** Epoch milliseconds. A point is visible once growth time >= this. */
  time: number
}

export interface Hypha {
  id: string
  kind: HyphaKind
  ref: NetworkRef
  /** Epoch milliseconds. Equal to `splitTime` (or the model's first event time for `main`). */
  time: number
  /** `null` only for `main`. */
  parentHyphaId: string | null
  /**
   * Where this hypha leaves its parent -- the PR's first-commit time,
   * clamped to be >= the parent's own start, so a child never appears to
   * predate its parent.
   */
  splitTime: number
  /** `mergedAt` (fused), `closedAt` (dead end), or the model's last event time (open/live, still growing). */
  endTime: number
  status: 'fused' | 'dead_end' | 'open'
  /** Base -> tip polyline, Catmull-Rom sampled with organic jitter (0 amplitude at split/fuse). */
  points: HyphaPoint[]
  /** Interval-scheduling lane index among same-parent, same-side siblings (0 for `main`). */
  lane: number
  /** Which side of the parent's tangent this hypha bows toward (0 for `main`). */
  side: -1 | 0 | 1
  /** Real commit count backing this hypha (PR's `commitCount`, or rendered node count for `main`/`liveBranch`). */
  commitCount: number
}

export interface NetworkNode {
  id: string
  kind: 'node'
  hyphaId: string
  time: number
  ref: NetworkRef
  position: Vec3
  radius: number
  /** True for a merged PR's fuse-point commit, rendered on the parent hypha. */
  isMergePoint: boolean
}

/** The actively-growing endpoint of an `open`/`liveBranch` hypha -- a separate selectable element from the hypha itself. */
export interface Tip {
  id: string
  kind: 'tip'
  hyphaId: string
  time: number
  ref: NetworkRef
  position: Vec3
}

/**
 * A short, fine lateral filament branching off a real commit node -- pure
 * mycelial texture, never decorative: every hair carries the same `ref` as
 * the commit node it grows from. One hair is generated per rendered commit
 * node (see `NetworkSummary.hairCount`/`NetworkModel.hairs.length ===
 * NetworkModel.nodes.length`), so the fuzzy "dense mat" texture always maps
 * 1:1 onto real data instead of being sprinkled decoratively. Not
 * independently selectable (it decorates its `nodeId`'s already-lookupable
 * `NetworkNode`), so it is intentionally excluded from
 * `LookupableNetworkElement`.
 */
export interface Hair {
  id: string
  kind: 'hair'
  hyphaId: string
  /** The `NetworkNode.id` this hair branches off. */
  nodeId: string
  time: number
  ref: NetworkRef
  /** Base point on the hypha where the hair branches off (== its node's position). */
  position: Vec3
  /** Unit direction the hair points, alternating side + seeded jitter. */
  direction: Vec3
  length: number
  /** Radius at the base; tapers toward 0 at the tip. */
  baseRadius: number
}

export interface Mushroom {
  id: string
  kind: 'mushroom'
  time: number
  ref: NetworkRef
  position: Vec3
  scale: number
  /** Groups close-in-time releases so they render as one small cluster; `null` if standalone. */
  clusterId: string | null
}

export interface Spore {
  id: 'spore'
  kind: 'spore'
  time: number
  ref: NetworkRef
  position: Vec3
}

/** Honest aggregate counts for elements the caps left out, never fabricated. */
export interface NetworkOverflow {
  /** PR-derived hyphae beyond the render cap (see `NetworkBuildOptions.maxHyphae`). */
  hyphaeOmitted: number
  /** Commit nodes omitted per hypha id, beyond the per-hypha node cap. */
  nodesOmittedByHypha: Record<string, number>
}

export interface NetworkBounds {
  time: TimeBounds
  /** Bounding radius (world units) of every point in the model, for camera/legend framing. */
  radius: number
}

export interface NetworkSummary {
  hyphaCountByKind: Record<HyphaKind, number>
  nodeCount: number
  mushroomCount: number
  /** Always equal to `nodeCount` -- one hair per rendered commit node. */
  hairCount: number
}

export interface NetworkModel {
  seed: string
  bounds: NetworkBounds
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  mushrooms: Mushroom[]
  hairs: Hair[]
  overflow: NetworkOverflow
  summary: NetworkSummary
}

/** The subset of element kinds `findNetworkElement` can look up by id (excludes the spore, which is looked up via the fixed `'spore'` id). */
export type LookupableNetworkElement = Hypha | NetworkNode | Tip | Mushroom
