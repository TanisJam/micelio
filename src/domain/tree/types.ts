import type { Vec3 } from './vector'

/**
 * The tree model: a deterministic, pure-data layout derived from a
 * `RepoSnapshot`. No React, no three.js -- the UI layer turns this into
 * geometry.
 */

export type TreeRefType =
  | 'repo'
  | 'era'
  | 'release'
  | 'pull_request'
  | 'commit'
  | 'branch'
  | 'language'

/** Points back to the real GitHub data an element represents. */
export interface TreeRef {
  type: TreeRefType
  /** Release tag, PR number (as string), commit oid, branch name, or language name. */
  id: string
}

export type TreeElementKind =
  | 'trunkSegment'
  | 'limb'
  | 'twig'
  | 'leaf'
  | 'flower'
  | 'fruit'
  | 'bud'
  | 'soilStratum'

/** Fields every tree element carries, so the UI can always inspect it. */
export interface TreeElementBase {
  id: string
  kind: TreeElementKind
  /** Epoch milliseconds. Used to drive the growth time-lapse replay. */
  time: number
  ref: TreeRef
}

export interface TrunkSegment extends TreeElementBase {
  kind: 'trunkSegment'
  start: Vec3
  end: Vec3
  radiusStart: number
  radiusEnd: number
}

export interface Trunk {
  segments: TrunkSegment[]
  height: number
  baseRadius: number
}

export interface LimbPoint {
  position: Vec3
  radius: number
}

export interface Limb extends TreeElementBase {
  kind: 'limb'
  eraIndex: number
  /** Base -> tip polyline. */
  points: LimbPoint[]
  /** Merged-PR count driving this limb's length/radius (pre-twig-cap). */
  activity: number
  /** Merged PRs in this era beyond `maxTwigsPerLimb`; represented as extra leaf density instead of twigs. */
  overflowPrCount: number
}

export interface TwigPoint {
  position: Vec3
  radius: number
}

export interface Twig extends TreeElementBase {
  kind: 'twig'
  limbId: string
  /** Base (on the limb) -> tip polyline. */
  points: TwigPoint[]
  side: -1 | 1
}

export interface Fruit extends TreeElementBase {
  kind: 'fruit'
  position: Vec3
  scale: number
}

export interface Leaf extends TreeElementBase {
  kind: 'leaf'
  position: Vec3
  /** Rotation around Y, radians. */
  rotation: number
  scale: number
  /** 0 (fresh green) -> 1 (autumn); derived from the commit's position in the repo's history. */
  age: number
  /** The twig this leaf clusters around, or null for overflow (limb-level) leaves. */
  twigId: string | null
  /** The limb this leaf belongs to (directly, or via its twig). Lets the UI gate a leaf's growth pop-in on its supporting branch, not just its own commit time. */
  limbId: string
}

export interface Flower extends TreeElementBase {
  kind: 'flower'
  position: Vec3
  scale: number
  limbId: string | null
}

export type BudSource = 'open_pull_request' | 'live_branch'

export interface Bud extends TreeElementBase {
  kind: 'bud'
  position: Vec3
  scale: number
  source: BudSource
}

export interface SoilStratum extends TreeElementBase {
  kind: 'soilStratum'
  /** Fraction of the soil cross-section this language occupies, 0..1. */
  share: number
  /** Cumulative fraction where this stratum starts, 0..1 (stacked bottom-up). */
  offset: number
  color: string | null
}

export interface TimeBounds {
  firstEventTime: number
  lastEventTime: number
}

export interface TreeModel {
  seed: string
  bounds: TimeBounds
  trunk: Trunk
  limbs: Limb[]
  twigs: Twig[]
  fruits: Fruit[]
  leaves: Leaf[]
  flowers: Flower[]
  buds: Bud[]
  soil: SoilStratum[]
}

/** The subset of element kinds `findTreeElement` can look up by id (excludes trunk segments and soil, which aren't individually selectable). */
export type LookupableTreeElement = Limb | Twig | Fruit | Leaf | Flower | Bud
