import type { TimeBounds } from '../shared/types'
import type { Vec3 } from '../shared/vector'

/**
 * The network (mycelium) model: a deterministic, pure-data layout derived
 * from a `RepoSnapshot`, mapping git's branch/merge DAG ~1:1 onto hyphae
 * that split off a parent and either fuse back (merged PR), dry out (closed
 * PR) or keep growing (open PR / live branch). No React, no three.js -- the
 * UI layer turns this into geometry (M3).
 *
 * Reuses `../shared/vector` (`Vec3`) and `../shared/timeBounds`
 * (`computeTimeBounds`/`TimeBounds`) rather than duplicating them: both are
 * metaphor-agnostic pure helpers, moved out of the now-deleted
 * `src/domain/tree/` in M4.
 */

export type NetworkRefType = 'repo' | 'release' | 'pull_request' | 'commit' | 'branch' | 'direct_burst'

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
  /**
   * A WORK BURST of direct (non-PR) commits pushed straight to the default
   * branch (Unit 2) -- splits from `main` at the burst's first commit and
   * fuses back (like a merged PR: real trunk work) at its last, with its own
   * commits as hairs. Grouping (`groupDirectCommitBursts`): consecutive
   * commits by the same author less than `DIRECT_BURST_MAX_GAP_MS` apart.
   */
  | 'direct'

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
  /**
   * Honesty flag for the detail panel (see `Fusion`/M2c colony mapping):
   * `'parent-branch'` means the split point sits on the real parent hypha's
   * own curve (a true git base-branch relationship). `'colony'` means the
   * split point is a visual sprout from the nearest structure in the
   * author's sector (the colony/ring/spore), used only when a PR's real
   * base is the default branch itself -- the UI must not word this as
   * "branched from a specific commit". `null` only for `main` (no parent).
   */
  attachment: 'colony' | 'parent-branch' | null
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

/**
 * A faint concentric growth ring on the colony disc, either at a real
 * release's radius (`ringKind: 'release'`, carrying that release's own
 * `ref` -- the same one its mushroom(s) carry) or at a calendar-year
 * boundary (`ringKind: 'year'`, `ref: null` -- purely a faint background
 * grid derived from real elapsed time, not an individually clickable
 * element, so intentionally excluded from `LookupableNetworkElement`).
 */
export interface GrowthRing {
  id: string
  kind: 'ring'
  ringKind: 'release' | 'year'
  time: number
  radius: number
  ref: NetworkRef | null
}

/**
 * The honest visual record of where a merged PR's hypha "fuses" back into
 * the mycelium -- a small knot at the hypha's own real tip (`position`, real
 * `mergedAt` time/place) plus a short anastomosis bridge to whichever real
 * structure (another hypha's point, or a growth ring) happens to be nearest
 * at that radius (`bridgeTo`). The bridge target is a visual anchor, not a
 * claimed data relationship -- see `Hypha.attachment` for the equivalent
 * honesty flag on the split end.
 */
export interface Fusion {
  id: string
  kind: 'fusion'
  hyphaId: string
  time: number
  ref: NetworkRef
  position: Vec3
  bridgeTo: Vec3
  bridgeToKind: 'hypha' | 'ring' | 'spore'
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
  /**
   * The merged PR whose hypha this mushroom sits on (M2d) -- the merged PR
   * that landed closest before the release, when its own hypha's real
   * work-driven length actually reaches the release's ring radius. `null`
   * when no such real data link exists (the mushroom still sits exactly on
   * its ring, honestly placed by the golden-angle sequence -- see
   * `mushrooms.ts` -- rather than a fabricated data anchor).
   */
  nearPr: NetworkRef | null
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
  /** Always equal to the count of `merged` hyphae -- a fusion knot exists iff merged. */
  fusionCount: number
}

/** M4 removed the earlier `'spiral'` layout once `'colony'` superseded it as the product's only mycelium visualization -- kept as a (single-value) literal type, not a plain `string`, so the field still documents its intent. */
export type NetworkLayoutMode = 'colony'

export interface NetworkModel {
  seed: string
  layout: NetworkLayoutMode
  bounds: NetworkBounds
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  mushrooms: Mushroom[]
  hairs: Hair[]
  /** Concentric release/year growth rings. */
  rings: GrowthRing[]
  /** One fusion knot + bridge per merged hypha. */
  fusions: Fusion[]
  overflow: NetworkOverflow
  summary: NetworkSummary
}

/** The subset of element kinds `findNetworkElement` can look up by id (excludes the spore, which is looked up via the fixed `'spore'` id). */
export type LookupableNetworkElement = Hypha | NetworkNode | Tip | Mushroom
