import type { ReleaseInfo } from '../repo'
import { clamp, easeInOutCubic, lerp, logScale } from '../math'
import { createPrng, randJitter, randRange, type Prng } from '../shared/prng'
import type { TimeBounds } from '../shared/types'
import { addVec3, normalizeVec3, polarToVec3, scaleVec3, subVec3, vec3, vec3Length, type Vec3 } from '../shared/vector'
import {
  capEvenly,
  DEFAULT_LAYOUT_OPTIONS,
  discRadius,
  DISC_MAX_RADIUS,
  pointOnHyphaAtRadius,
  radiusForCommitCount,
  radiusForFrac,
  timeToFrac,
  type LayoutOptions,
} from './ringGeometry'
import { buildMushroomsOnRings } from './mushrooms'
import { recentGrowthFactor } from './renderHints'
import type { HyphaCommitDraft, HyphaDraft } from './topology'
import type { Fusion, GrowthRing, Hair, Hypha, HyphaPoint, Mushroom, NetworkNode, Spore, Tip } from './types'

/**
 * The RADIAL COLONY layout (M2d rewrite of M2c): grows the mycelium the way
 * space colonization/gap-filling growth actually looks, instead of M2c's
 * "author sector" mapping. The orchestrator's review of the M2c images found
 * they read as nested polygons/tangential arcs, not mycelium -- root-caused
 * to two design choices, both removed here:
 *
 * 1. Hypha LENGTH was `endTime - splitTime` (real duration): a PR open for
 *    years but touching one file drew a long spoke; a huge PR merged in a
 *    day drew a dot. Replaced with a WORK-driven length (commits +
 *    added/deleted lines, log-scaled) -- see `computeWorkLength`.
 * 2. ANGLE was the PR author's fixed sector, and a hypha swept from its
 *    sprout angle to that fixed target across its *entire* length --
 *    reading as a tangential arc/chord, especially for a far sector.
 *    Replaced with GAP-FILLING: a hypha's target angle is the center of the
 *    largest angular gap among whatever already occupies its own starting
 *    radius (`chooseTargetAngle`), with only a short Y-fork turn near the
 *    base, then near-radial growth (`growHyphaPoints`) -- author is no
 *    longer part of layout at all (kept only as optional color metadata,
 *    see `sectors.ts`).
 *
 * Shares `topology.ts` (the DAG) with the spiral layout; only the geometry
 * strategy differs. See the M2d section of `odd/tasks/micelio-mvp.md` for the
 * full mapping rationale and the per-round visual iteration notes.
 */

// --- Work -> length (item 2 of the M2d brief) -----------------------------
/** Shortest a hypha is ever drawn (a single-commit, no-diff-stats PR) -- still a visible, deliberate filament, never a dot. */
export const COLONY_LENGTH_MIN = 0.25
/** Longest a hypha is ever drawn, regardless of how much real work backs it. */
export const COLONY_LENGTH_MAX = 1.4
/** A closed-unmerged PR's hypha is stunted -- same work-based length, scaled down (a dead branch that never fully grew). */
export const COLONY_CLOSED_LENGTH_MULTIPLIER = 0.6
const WORK_COMMIT_WEIGHT = 1
/** Lines matter, but far less per-unit than a commit (a single 2000-line vendor-file commit shouldn't dominate); tuned during visual iteration. */
const WORK_LINE_WEIGHT = 0.015
const WORK_LENGTH_SCALE = 0.34

/**
 * `commits*a + lines*b`, log-scaled and clamped into `[COLONY_LENGTH_MIN,
 * COLONY_LENGTH_MAX]` -- see the module doc's point 1. `workLines` is `null`
 * for a closed/open PR (no diff stats fetched, see M1); treated as 0 real
 * lines, never fabricated. Exported for tests: this is `L_h` from the task
 * brief, which is NOT always the same as a hypha's own rendered radial
 * extent (`endRadius - startRadius`) -- see the "r_end = r0 + L_h" comment
 * at this function's call site for why a spore-started hypha's rendered
 * length can legitimately exceed `L_h`.
 */
export function computeWorkLength(commitCount: number, workLines: number | null): number {
  const lines = workLines ?? 0
  const work = Math.max(0, commitCount) * WORK_COMMIT_WEIGHT + Math.max(0, lines) * WORK_LINE_WEIGHT
  const raw = COLONY_LENGTH_MIN + WORK_LENGTH_SCALE * Math.log1p(work)
  return clamp(raw, COLONY_LENGTH_MIN, COLONY_LENGTH_MAX)
}

// --- Gap-filling angle (item 2 of the M2d brief) --------------------------
/** Fixed reference rays from the spore, always considered alongside whatever already spans a given radius -- keeps the very first handful of hyphae (and any radius where only one neighbor exists) from collapsing the "largest gap" search into one enormous, poorly-centered arc. See `chooseTargetAngle`. */
const SPORE_RAY_COUNT = 10
/** "target angle = gap center + small seeded jitter (<= 10% of gap)". */
const GAP_JITTER_FRACTION = 0.1
/** A direct-commit spur is minor texture, not a structural hypha -- a looser jitter reads as more organic without needing to be precisely gap-centered. */
const SPUR_GAP_JITTER_FRACTION = 0.22

// --- Growth-path shaping (item 2e of the M2d brief) -----------------------
const FORK_FRACTION_MIN = 0.15
const FORK_FRACTION_MAX = 0.25
/** Floor for the radius used in every radius-dependent angle-cap conversion below, so a hypha starting extremely close to the spore doesn't get a wild angle swing from dividing by a near-zero radius. */
const MIN_RADIUS_FOR_ANGLE_CAP = 0.12
/**
 * Bounds the fork's total achievable turn (from the real start position's
 * own angle to the gap-filling target) by how much LATERAL (sideways)
 * distance that turn would sweep through at this hypha's own radius --
 * NOT by a fixed angle. An angle that's perfectly reasonable right next to
 * the spore (tiny radius -> tiny lateral sweep even for a wide turn)
 * becomes a huge, unnatural sideways loop at a large disc radius (lateral
 * distance is radius*angle, so it grows with radius for a fixed angle).
 * Round 2 of visual iteration (orchestrator feedback): an angle-only cap
 * still produced wide sweeping turns/a "big sinusoidal zigzag" wherever the
 * gap-driven target happened to be far from a real attach point at a large
 * radius. The lateral budget itself scales with the hypha's OWN length, so
 * a short hypha gets a proportionately short, modest turn.
 *
 * Used for the TOPOLOGY "is this a natural fit?" decision
 * (`layoutNetworkColony`'s `naturalFit` check) -- kept at its original,
 * more permissive value so which hyphae attach to a real neighbor vs. fall
 * back to sprouting fresh from the spore is UNCHANGED by the T10 rim fix
 * below (see `FORK_RENDER_LATERAL_BUDGET_FRACTION`'s doc comment for why a
 * second, render-only constant exists instead of tightening this one
 * directly -- tightening this one turned out to reclassify hundreds of
 * hyphae as spore-started, a much bigger, unintended shape change).
 */
const FORK_LATERAL_BUDGET_FRACTION = 0.5
/**
 * T10 (second-pass rim fix). Used ONLY for the fork's actual RENDERED turn
 * once a hypha has already been placed (`growHyphaPoints`'s own `maxTurn`)
 * -- deliberately a separate, tighter constant from
 * `FORK_LATERAL_BUDGET_FRACTION` above. An early version of this fix simply
 * lowered that shared constant, which also tightened the TOPOLOGY
 * `naturalFit` check (same function, same input) -- since that check decides
 * whether a hypha attaches to a real neighbor or falls back to sprouting
 * fresh from the spore, tightening it reclassified hundreds of hyphae
 * colony-wide as spore-started, a large, unintended change to the disc's
 * overall shape rather than a focused rim fix. Splitting the two uses keeps
 * topology (which hyphae attach where) exactly as before, while shrinking
 * only how far the fork is allowed to swing sideways once growth actually
 * draws it.
 *
 * `0.5` still let a fork's lateral swing reach up to HALF the hypha's own
 * length whenever the raw gap-filling target sat far enough from the real
 * attach point -- proportionate to length by construction, but a fork
 * consuming up to 50% of a short hypha's own length as sideways motion
 * before heading outward IS a visible kink/hook near its base, not a subtle
 * turn, regardless of how gently it's sampled or later smoothed. Confirmed
 * directly on the express fixture (`scripts/diagnose-rim.ts`, not
 * committed): with swirl disabled entirely (isolating pure growth), the
 * worst short rim hyphae's own base->tip straight-chord deviation was up to
 * ~27% of their own length from the fork's eased turn alone -- e.g.
 * `hypha-pr6991` (length 0.53) turns barely ~2.4deg in absolute angle, but
 * at its own real radius (~4.9-5.25) that tiny angle still sweeps ~0.17-0.2
 * world units sideways, a third of its own length, reading as a
 * base-hugging "L" bend. Tightened to `0.15`: the same hypha's max lateral
 * deviation drops to ~11-16% of its own length colony-wide (short+rim
 * median), a fine taper rather than a hook, while `FORK_ABSOLUTE_MAX_RAD`
 * (70deg) remains the separate, still generous ceiling for the rare
 * very-close-to-spore case where the lateral budget alone would otherwise
 * allow an unnaturally wide turn.
 */
const FORK_RENDER_LATERAL_BUDGET_FRACTION = 0.15
/** Absolute ceiling on the turn regardless of how generous the lateral budget computes to -- keeps even a very short, very central hypha's fork from folding back on itself. */
const FORK_ABSOLUTE_MAX_RAD = (70 * Math.PI) / 180
/** How much of the curve after the fork ramps the organic drift in from 0, so the fork's own end (angle == target, no drift) and the post-fork wiggle meet without a kink. */
const FORK_DRIFT_RAMP = 0.15
/**
 * Final polish pass, Unit 1c: how much of a recent-slice (rim, still-young)
 * hypha's own rendered length its curvature-continuity bias is allowed to
 * consume as LATERAL (sideways) distance, at full recency -- mirrors
 * `POST_FORK_LATERAL_LENGTH_CAP_FRACTION`'s own pattern (a fraction of the
 * hypha's own length, converted to an angle via its own radius, never a
 * fixed absolute angle) for exactly the reason documented there: a fixed
 * angle sweeps a large absolute lateral distance at a large rim radius,
 * which is what produced the T9/T10 "hook" artifact this same file already
 * fixed once. Kept modest (well under `POST_FORK_LATERAL_LENGTH_CAP_
 * FRACTION`'s own 0.06 ceiling would be too subtle to read as "continuing
 * the arm" at all; this is deliberately a bit more generous since, unlike
 * the wiggle, it's a single smooth bend in one direction, not an
 * oscillation) so it reads as a soft, confident curve rather than another
 * wobble.
 */
const RIM_CURL_CONTINUITY_LENGTH_FRACTION = 0.1
/**
 * Rotational sense (`+1`) the curvature-continuity bias always leans, so a
 * young rim filament visibly continues an arm's curve rather than bending at
 * random. Deliberately a FIXED constant, matching `DEFAULT_LAYOUT_OPTIONS.
 * swirl`'s own sign (positive), rather than reading the actual `swirl`
 * option passed to `layoutNetworkColony` -- growth (this function) must stay
 * swirl-config-independent, an invariant this same module already documents
 * ("the galaxy swirl is the very last step ... every invariant above this
 * line is established on the pre-swirl geometry", see `layoutNetworkColony`'s
 * own closing comment) and that the test suite relies on directly (several
 * tests build a `swirl: 0` "plain" reference layout and a normal-swirl one
 * from the SAME topology, then assert the two only ever differ by a uniform
 * post-hoc rotation -- reading `resolved.swirl` here broke exactly that
 * invariant for recent-slice hyphae during this fix's own first attempt).
 */
const RIM_CURL_DIRECTION = 1
/** Well under one full cycle across the whole post-fork span -- a gentle bow, not a visible zigzag (round 2 finding: a higher frequency read as a jagged sawtooth even at a small amplitude, since an SVG polyline draws straight segments between samples). */
const CURL_FREQ_MIN = 0.5
const CURL_FREQ_MAX = 0.9
const CURL_PHASE_MAX = Math.PI * 2
/**
 * Amplitude of the post-fork organic wiggle around the target angle (item
 * 2e's "angular drift <= 0.06 rad total", tightened further after round 2's
 * "barely perceptible" note -- well under both that target and the 0.1 rad
 * test ceiling).
 */
const POST_FORK_DRIFT_MAX_RAD = 0.02
/** "lateral amplitude <= 0.02*R" (item 2e) is the spec ceiling; kept at half that (0.01*R) per round 2's "barely perceptible" note. */
const LATERAL_MAX_WORLD = 0.01 * DISC_MAX_RADIUS
/** For a hypha longer than `COLONY_LENGTH_MAX` (a spore-started one whose real r0 is large -- see `growHyphaPoints`), the lateral wiggle budget instead scales with its OWN length by this fraction, so a long strand still visibly meanders rather than reading as a rigid straight spoke. */
const WIGGLE_LENGTH_FRACTION = 0.05
/**
 * Hard ceiling on the post-fork lateral wiggle budget, as a fraction of the
 * hypha's OWN rendered length (`endRadius - startRadius`, AFTER
 * `COLONY_RADIUS_CAP` clamping -- see `growHyphaPoints`'s `lateralBudget`).
 *
 * Root cause of the rim "hook"/blocky-fragment artifact (T9): `LATERAL_MAX_
 * WORLD` is a fixed world-space distance, tuned to read as "barely
 * perceptible" against a hypha's INTENDED (COLONY_LENGTH_MIN..MAX) length.
 * When the rim clamp compresses a hypha's RENDERED length well below that --
 * common for a hypha whose natural start radius already sits close to the
 * disc edge -- that same fixed wiggle no longer reads as barely perceptible:
 * its per-sample TANGENTIAL swing becomes comparable to (or bigger than) the
 * per-sample RADIAL step, so the polyline's local tangent direction swings
 * sharply at each oscillation extremum instead of smoothly tracking the
 * radius outward -- a real zigzag/hook in the polyline itself, not a
 * rendering bug. Confirmed against the bundled `expressjs/express` fixture:
 * 304 rim hyphae (endRadius within 0.15 of the cap) had a >60deg turning
 * angle between consecutive segments before this fix, some as high as
 * ~124deg; 0 after. Only binds below `LATERAL_MAX_WORLD /
 * POST_FORK_LATERAL_LENGTH_CAP_FRACTION` (~0.33 units), so a normal
 * (uncompressed) hypha's wiggle is unchanged.
 *
 * T10 (second pass) finding: 0.15 closed the PER-SEGMENT turn ceiling (no
 * single segment turn > `MAX_HYPHA_TURN_RAD`), but for a SHORT rim hypha
 * (rendered length ~0.3-0.4, common once `COLONY_RADIUS_CAP` truncates it)
 * 15% of that length is still a real, visible ABSOLUTE lateral swing
 * (~0.045-0.06 world units) -- big enough, relative to the hypha's own tiny
 * length, to read as a wobble/wiggle even though no individual segment turn
 * exceeds the 60deg ceiling. Confirmed on the express fixture: the worst
 * offenders' x-coordinate wandered by up to ~0.077 units while their own
 * total rendered length was only ~0.38-0.41 -- a ~20% lateral excursion.
 * Tightened to 0.06: for a hypha at or above ~0.83 units long this constant
 * no longer binds at all (the `LATERAL_MAX_WORLD`-driven `Math.max` above
 * already returns a smaller value), so ordinary mid/long hyphae are
 * unaffected; only the short (rim-typical) tail gets a proportionately
 * tighter wiggle.
 */
const POST_FORK_LATERAL_LENGTH_CAP_FRACTION = 0.06
/**
 * T10 (second pass rim fix): caps a hypha's OWN base radius (`thicknessStart`,
 * driven purely by `radiusForCommitCount(commitCount)` -- see
 * `growHyphaPoints`) as a fraction of its own RENDERED length (`endRadius -
 * startRadius`, after `COLONY_RADIUS_CAP` clamping). Root cause: hypha
 * THICKNESS has never depended on hypha LENGTH -- a hypha with a handful of
 * commits gets the same base radius whether it renders 0.05 units long or
 * 1.4 units long. That mismatch is invisible for a normal-length hypha (the
 * ribbon's full rendered width, `radius * RIBBON_WIDTH_SCALE`, stays a small
 * fraction of a >=0.7-unit strand) but becomes a literal wedge once
 * `COLONY_RADIUS_CAP` truncates a hypha's rendered length well below its
 * intended reach while leaving its commit-driven thickness untouched.
 * Measured on the express fixture (`scripts/diagnose-rim.ts`, not committed),
 * against the hypha's own RADIAL SPAN (`endRadius - startRadius`, the exact
 * quantity `growHyphaPoints` calls `totalLength` and caps against here --
 * NOT the longer rendered arc length, which the fork/wiggle's own path
 * naturally inflates beyond it): the colony-wide ratio of raw (uncapped)
 * base radius to radial span already has a median of ~0.031 and a p90 of
 * ~0.062 -- i.e. a fair number of ordinary, perfectly fine-looking hyphae
 * everywhere on the disc sit in that range by design, so a cap anywhere
 * near the median (an earlier, wrongly-tuned attempt used `0.03`, measured
 * against arc length instead of radial span, and ended up clipping roughly
 * half the entire colony) is NOT rim-specific at all. The real outliers are
 * a distinct, much higher tail: the worst ~16-50 hyphae (ratio > ~0.075-
 * 0.065) are 100% at the rim (`endRadius` within 0.15 of `COLONY_RADIUS_
 * CAP`), topping out at ~0.089 (a rendered full width, `ratio *
 * RIBBON_WIDTH_SCALE`, of ~44% of the hypha's own radial span). `0.06`
 * affects exactly 99 hyphae, 100% of them at the rim -- comfortably above
 * the colony-wide p90 (so it leaves the ordinary interior population
 * untouched) and comfortably below the worst offenders (so it still visibly
 * thins them).
 */
export const WIDTH_TO_LENGTH_CAP_FRACTION = 0.06
/**
 * Minimum sample count guaranteed inside `[0, rampEnd]` (the fork's own
 * eased turn plus its drift ramp-in), regardless of the hypha's total sample
 * budget -- part 2 of the rim-artifact fix (T9). The fork's eased turn and
 * the swirl rotation applied afterward (`applySwirl`, a separate cosmetic
 * post-process) are each individually smooth in isolation, but a short
 * hypha's own `forkFraction`-sized slice of its (already small) sample
 * budget could be as few as 2-3 points -- coarse enough to alias their sum
 * into a visible zigzag/hook wherever the two happen to have opposing local
 * slopes, even though the true underlying curve has none. Redistributing
 * (not adding) samples from the long, gently-varying post-ramp stretch into
 * this region resolves it densely enough to track the real curve, at no
 * extra vertex cost.
 */
const MIN_FORK_SAMPLES = 8
/**
 * Ceiling on the turning angle between consecutive polyline segments a
 * FINAL (post-swirl) colony hypha is allowed to keep -- part 3 of the
 * rim-artifact fix (T9), the one that actually closes it. The fork's own
 * eased turn (`growHyphaPoints`) and the separate cosmetic swirl rotation
 * applied afterward (`applySwirlToPosition`, per-point, radius-dependent)
 * are each individually smooth, but their SUM can have a real, if modest,
 * local reversal wherever the two have opposing rates at a given sample --
 * most often right after a natural-fit fork attaches near an already-large
 * disc radius, where the fork's own turn and swirl's differential across
 * even a short remaining radial span are comparable in size. At a hypha's
 * own (length-appropriate) sample spacing this reads as a sharp zigzag/hook
 * rather than the gentle bend the underlying continuous curve actually has
 * -- confirmed by resampling the express fixture's colony at ~20x the
 * normal resolution (`diagnose-rim.ts`, scratch script, not committed): the
 * same hooks shrink from up to ~124deg to a much gentler bend, well under
 * this ceiling. `relaxSharpTurns` removes what's left by pulling any
 * interior point whose turn still exceeds this back onto the smooth path
 * its own neighbors already describe.
 */
const MAX_HYPHA_TURN_RAD = (60 * Math.PI) / 180
const Y_JITTER = 0.015
const SAMPLES_MIN = 12
const SAMPLES_MAX = 40
/**
 * "clamp open/long hyphae so the disc stays round" (round 2 orchestrator
 * feedback -- the un-clamped model measured `bounds.radius` up to 6.25
 * against a nominal `DISC_MAX_RADIUS` of 5). Applied to every hypha's own
 * `endRadius`, not just open/dead-end ones: a hard rim, 5% beyond the
 * nominal disc for a little organic overrun without an obviously-clipped
 * flat edge.
 */
const COLONY_RADIUS_CAP = DISC_MAX_RADIUS * 1.05
/**
 * Final polish pass, Unit 1b ("no radial clamp compression"): before this
 * fix, EVERY hypha whose `nominalEndRadius` overshot `COLONY_RADIUS_CAP` was
 * hard-clamped to that exact same radius (`Math.min(nominalEndRadius,
 * COLONY_RADIUS_CAP)`) -- a real hypha with a much larger nominal reach and
 * one barely past the cap both landed on the identical rendered `endRadius`.
 * Visually this is a literal ring of identically-long stubs right at the
 * rim: the "comb" the orchestrator's screenshot review flagged (a ring of
 * short, bright, perfectly uniform radial strokes), not an organic edge.
 *
 * `softenRimOvershoot` replaces the hard clamp with a soft, monotonic one:
 * a hypha at or under the cap is completely unaffected (`nominal <= cap`
 * returns `nominal` exactly, so every non-rim hypha's length is byte-for-
 * byte unchanged -- verified by test). Past the cap, only a FRACTION
 * (`RIM_OVERSHOOT_RETENTION`) of the excess reach is kept, so a hypha that
 * wanted to reach much farther still ends up visibly (if modestly) longer
 * than one that barely overshot -- real variation instead of one flat ring
 * -- while an outer hard ceiling (`RIM_OUTER_HARD_CAP`, a further 8% past
 * `COLONY_RADIUS_CAP`) still keeps the disc from growing unboundedly round
 * (the original "keep the disc round" requirement this cap exists for at
 * all).
 */
const RIM_OVERSHOOT_RETENTION = 0.4
const RIM_OUTER_HARD_CAP = COLONY_RADIUS_CAP * 1.08

/** See `RIM_OVERSHOOT_RETENTION`'s doc comment. Pure, exported for testing (the "no-clamp-compression rule"). */
export function softenRimOvershoot(nominal: number, cap: number): number {
  if (nominal <= cap) return nominal
  const excess = nominal - cap
  const retained = excess * RIM_OVERSHOOT_RETENTION
  return Math.min(cap + retained, RIM_OUTER_HARD_CAP)
}

// --- Fusion (anastomosis) search -------------------------------------------
/** "connect with a short bridge to the nearest OTHER hypha point within a small radius (<= 0.25)" (item 4). */
const FUSION_SEARCH_RADIUS = 0.25
const RADIUS_BIN_WIDTH = 0.1
/** Bins to each side of the tip's own bin -- `RADIUS_BIN_WIDTH * (2 * spread + 1)` comfortably covers `FUSION_SEARCH_RADIUS`. */
const FUSION_SEARCH_BIN_SPREAD = 3

// --- Direct-commit spur tuning (item 3 of the M2d brief) ------------------
const SPUR_LENGTH_MIN = 0.05
const SPUR_LENGTH_MAX = 0.16
const SPUR_LENGTH_JITTER = 0.015
const SPUR_BASE_RADIUS_FRACTION = 0.35
const SPUR_MIN_BASE_RADIUS = 0.002

// --- Hair tuning (reuses the spiral's `Hair` element) ----------------------
const HAIR_LENGTH_FACTOR = 2.2
const HAIR_LENGTH_MIN = 0.018
const HAIR_LENGTH_MAX = 0.05
const HAIR_LENGTH_JITTER = 0.008
const HAIR_MIN_LENGTH_FLOOR = 0.006
const HAIR_BASE_RADIUS_FRACTION = 0.35
const HAIR_MIN_BASE_RADIUS = 0.0015
const HAIR_ANGLE_JITTER = 0.5
const HAIR_MERGE_LENGTH_BOOST = 1.6

// --- Ring tuning ------------------------------------------------------------
const MAX_YEAR_RINGS = 40

/**
 * Re-expresses `to` as `from` plus the shortest signed angular distance
 * between them (in `(-pi, pi]`) -- critical before linearly interpolating
 * two angles that can represent the same direction while differing
 * numerically by nearly `2*pi` (an M2c bug, see the M2d task brief's root
 * cause #2 -- fixed there by this same function, kept here unchanged).
 */
function shortestAngleTo(from: number, to: number): number {
  const twoPi = Math.PI * 2
  const wrapped = (((to - from + Math.PI) % twoPi) + twoPi) % twoPi
  return from + wrapped - Math.PI
}

/** Circular distance (>= 0, <= pi) between two angles. */
function angularDistance(a: number, b: number): number {
  return Math.abs(shortestAngleTo(a, b) - a)
}

/**
 * "Find the LARGEST angular gap; target angle = gap center + small seeded
 * jitter (<= `jitterFraction` of the gap)." With zero reference angles,
 * picks an arbitrary seeded angle (nothing to fill a gap relative to). With
 * exactly one, the only sensible "gap center" is directly opposite it.
 */
function pickAngleInLargestGap(angles: number[], prng: Prng, jitterFraction: number): number {
  const twoPi = Math.PI * 2
  if (angles.length === 0) return randRange(prng, 0, twoPi)

  const normalized = angles.map((a) => ((a % twoPi) + twoPi) % twoPi).sort((a, b) => a - b)
  if (normalized.length === 1) {
    const center = normalized[0]! + Math.PI
    const jitter = jitterFraction > 0 ? randJitter(prng, Math.PI * jitterFraction) : 0
    return center + jitter
  }

  let bestGap = -1
  let bestCenter = 0
  for (let i = 0; i < normalized.length; i++) {
    const a = normalized[i]!
    const b = i + 1 < normalized.length ? normalized[i + 1]! : normalized[0]! + twoPi
    const gap = b - a
    if (gap > bestGap) {
      bestGap = gap
      bestCenter = a + gap / 2
    }
  }
  const jitter = jitterFraction > 0 ? randJitter(prng, bestGap * jitterFraction) : 0
  return bestCenter + jitter
}

interface SpanningEntry {
  hypha: Hypha
  angleAtR0: number
}

/** Every already-placed hypha whose disc-radius span (base -> tip) contains `r0`, with its own angle interpolated exactly at that radius -- item 2c/2d's "already-placed hypha that spans r0". */
function computeSpanning(placed: Hypha[], r0: number): SpanningEntry[] {
  const spanning: SpanningEntry[] = []
  for (const hypha of placed) {
    const startR = discRadius(hypha.points[0]!.position)
    const endR = discRadius(hypha.points[hypha.points.length - 1]!.position)
    if (r0 < startR - 1e-9 || r0 > endR + 1e-9) continue
    const at = pointOnHyphaAtRadius(hypha.points, r0)
    spanning.push({ hypha, angleAtR0: Math.atan2(at.position.z, at.position.x) })
  }
  return spanning
}

/**
 * Item 2c: if something already spans `r0`, target the largest gap among
 * those (plus the spore's fixed reference rays). Otherwise (nothing spans
 * `r0` yet -- typically early in construction, near the spore), maximize
 * distance to every already-placed hypha's own *start* -- "first hyphae
 * radiate around the spore evenly" -- which is the same largest-gap search
 * over a different candidate set, so it's the same helper either way.
 */
/**
 * A hypha's own directional identity near its base -- NOT literally
 * `points[0]`, which for a spore-started hypha (no real parent point to
 * leave from) is the origin `(0, 0, 0)` for every such hypha, an
 * indistinguishable degenerate angle (`atan2(0, 0) === 0`) that would
 * otherwise collapse the "existing hypha starts" fallback below into a
 * single repeated point. The second sample point always carries a real,
 * distinct direction (radial growth has already begun by then).
 */
function hyphaBaseDirectionAngle(hypha: Hypha): number {
  const point = hypha.points[1] ?? hypha.points[0]!
  return Math.atan2(point.position.z, point.position.x)
}

function chooseTargetAngle(spanning: SpanningEntry[], sporeRays: number[], placed: Hypha[], prng: Prng): number {
  if (spanning.length > 0) {
    const angles = [...spanning.map((s) => s.angleAtR0), ...sporeRays]
    return pickAngleInLargestGap(angles, prng, GAP_JITTER_FRACTION)
  }
  const starts = placed.map(hyphaBaseDirectionAngle)
  return pickAngleInLargestGap(starts, prng, 0)
}

/** Item 2d: "the hypha spanning r0 whose angle at r0 is angularly closest to theta_h" -- the literal parent-selection rule, by *position* angle. `null` when nothing spans r0. */
function closestSpanningByAngle(spanning: SpanningEntry[], targetAngle: number): SpanningEntry | null {
  let best: SpanningEntry | null = null
  let bestDist = Infinity
  for (const candidate of spanning) {
    const dist = angularDistance(candidate.angleAtR0, targetAngle)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best
}

/**
 * See `FORK_LATERAL_BUDGET_FRACTION`'s doc comment -- the maximum turn
 * (radians) a hypha of this radius and length may take from its real start
 * angle toward its gap-filling target. `budgetFraction` is passed
 * explicitly (rather than read from a single shared constant) since T10
 * split this into two independently-tuned uses -- see
 * `FORK_RENDER_LATERAL_BUDGET_FRACTION`'s doc comment.
 */
function maxTurnRadians(radius: number, length: number, budgetFraction: number): number {
  const lateralBudget = length * budgetFraction
  const fromLateral = lateralBudget / Math.max(radius, MIN_RADIUS_FOR_ANGLE_CAP)
  return Math.min(FORK_ABSOLUTE_MAX_RAD, fromLateral)
}

function sampleCountForLength(length: number): number {
  const span = COLONY_LENGTH_MAX - COLONY_LENGTH_MIN * COLONY_CLOSED_LENGTH_MULTIPLIER
  const t = span > 0 ? clamp((length - COLONY_LENGTH_MIN * COLONY_CLOSED_LENGTH_MULTIPLIER) / span, 0, 1) : 1
  return Math.round(lerp(SAMPLES_MIN, SAMPLES_MAX, t))
}

/**
 * `t` values for `growHyphaPoints`'s per-sample loop, biased so `[0,
 * rampEnd]` (the fork's own eased turn plus its drift ramp-in) always gets
 * at least `MIN_FORK_SAMPLES` of the hypha's own (unchanged) total
 * `sampleCount` -- see `MIN_FORK_SAMPLES`'s doc comment for why. `[rampEnd,
 * 1]` gets whatever remains, spaced evenly as before; the shared boundary at
 * `rampEnd` is only ever added once. Monotonically increasing by
 * construction (two independent evenly-spaced runs, the second starting
 * exactly where the first ends), so radius (which is `lerp(startRadius,
 * endRadius, t)`) stays non-decreasing along the path exactly as it always
 * has.
 */
export function buildForkBiasedSampleTimes(sampleCount: number, rampEnd: number): number[] {
  if (sampleCount <= 1) return [0]
  const forkSampleCount = clamp(Math.round(sampleCount * rampEnd), MIN_FORK_SAMPLES, sampleCount - 1)
  const postForkSampleCount = sampleCount - forkSampleCount
  const times: number[] = []
  for (let i = 0; i < forkSampleCount; i++) {
    times.push(forkSampleCount > 1 ? (i / (forkSampleCount - 1)) * rampEnd : 0)
  }
  for (let i = 1; i <= postForkSampleCount; i++) {
    times.push(postForkSampleCount > 1 ? rampEnd + (i / postForkSampleCount) * (1 - rampEnd) : 1)
  }
  return times
}

interface GrowParams {
  startPosition: Vec3
  startRadius: number
  targetAngleRaw: number
  endRadius: number
  splitTime: number
  endTime: number
  commitCount: number
  status: HyphaDraft['status']
  prng: Prng
  /** Unit 1c of the final polish pass: `recentGrowthFactor` for this hypha's own split time -- `0` (not recent, no bias applied) .. `1` (the most recent event in the whole span). */
  rimCurl: number
}

/**
 * Item 2e: starts exactly at the parent's real point (or the spore's
 * origin), turns from that point's own REAL angle to the target angle over
 * the first ~15-25% of the length (a Y-fork, its total turn bounded by
 * `maxTurnRadians` -- see that doc comment), then grows near-radially with
 * a small organic wiggle. Radius is always `lerp(startRadius, endRadius, t)`
 * -- by construction (via `polarToVec3`) the rendered disc-radius of every
 * sample exactly equals that value, so "radius non-decreasing along the
 * path" holds exactly, not approximately, regardless of angle.
 *
 * Deliberately does NOT use the parent curve's local TANGENT (direction of
 * travel) as the fork's starting direction, despite that being the more
 * "graceful" choice on paper -- round 2 of visual iteration found this
 * produced actual DISCONTINUITIES: `points[0]` is always forced to the
 * parent's real POSITION, but a tangent can point in a meaningfully
 * different direction than that position's own angle (e.g. if the attach
 * point sits inside the parent's own fork/drift), so growth computed via
 * `polarToVec3(tangent-based angle, ...)` for the very next sample could
 * jump to a completely different angle at nearly the same radius -- a
 * multi-unit single-segment "chord" straight across the disc (see the round
 * 2 progress notes for the measured example). Using the position's own
 * angle as the starting direction is trivially exact and only that: the
 * next sample's angle differs from `points[0]`'s by an infinitesimal amount
 * as `t -> 0`, so continuity holds by construction.
 */
function growHyphaPoints(params: GrowParams): HyphaPoint[] {
  const { startPosition, startRadius, targetAngleRaw, endRadius, splitTime, endTime, commitCount, status, prng, rimCurl } = params

  // T10: rendered length is needed BEFORE thickness now -- see
  // `WIDTH_TO_LENGTH_CAP_FRACTION`'s doc comment for why base width must be
  // capped relative to it.
  const totalLength = Math.max(0, endRadius - startRadius)
  const thicknessStart = Math.min(radiusForCommitCount(commitCount), totalLength * WIDTH_TO_LENGTH_CAP_FRACTION)
  const thicknessEnd = status === 'fused' ? thicknessStart * 0.85 : status === 'dead_end' ? thicknessStart * 0.35 : thicknessStart * 0.7

  // At the spore itself (radius ~0) there is no meaningful "real angle" to
  // continue from (every direction is equally the start) and no lateral
  // distance for any turn to sweep through, so growth simply heads straight
  // for the target with no fork at all.
  const hasRealStartAngle = startRadius > 1e-6
  const startAngle = hasRealStartAngle ? Math.atan2(startPosition.z, startPosition.x) : targetAngleRaw
  const unwrappedTarget = shortestAngleTo(startAngle, targetAngleRaw)
  const maxTurn = hasRealStartAngle ? maxTurnRadians(startRadius, totalLength, FORK_RENDER_LATERAL_BUDGET_FRACTION) : Math.PI
  const targetAngle = startAngle + clamp(unwrappedTarget - startAngle, -maxTurn, maxTurn)

  const forkFraction = hasRealStartAngle ? randRange(prng, FORK_FRACTION_MIN, FORK_FRACTION_MAX) : 0
  const rampEnd = Math.min(1, forkFraction + FORK_DRIFT_RAMP)
  // A spore-started hypha can be meaningfully longer than a normal
  // (`COLONY_LENGTH_MAX`-bounded) one -- see the "r_end = r0 + L_h" comment
  // at the call site. `LATERAL_MAX_WORLD`/`POST_FORK_DRIFT_MAX_RAD` alone
  // (tuned for a <=1.4-unit hypha) reads as "barely perceptible" there but
  // renders as an almost perfectly straight spoke over a much longer run
  // (round 4 finding) -- scale both the lateral wiggle budget and the curl
  // frequency up with the hypha's own total length so a long strand still
  // visibly meanders, proportionate to how far it actually travels.
  // (`totalLength` is now computed above, before thickness -- see T10.)
  const lengthScale = Math.max(1, totalLength / COLONY_LENGTH_MAX)
  const lateralBudget = Math.min(
    Math.max(LATERAL_MAX_WORLD, totalLength * WIGGLE_LENGTH_FRACTION),
    totalLength * POST_FORK_LATERAL_LENGTH_CAP_FRACTION,
  )
  const curlFreq = randRange(prng, CURL_FREQ_MIN, CURL_FREQ_MAX) * lengthScale
  const curlPhase = randRange(prng, 0, CURL_PHASE_MAX)

  const sampleCount = clamp(sampleCountForLength(totalLength), SAMPLES_MIN, SAMPLES_MAX)
  const sampleTimes = buildForkBiasedSampleTimes(sampleCount, rampEnd)
  const points: HyphaPoint[] = []

  for (let i = 0; i < sampleCount; i++) {
    const t = sampleTimes[i]!
    const radius = lerp(startRadius, endRadius, t)
    const time = lerp(splitTime, endTime, t)

    let angle: number
    if (t <= forkFraction) {
      const localT = forkFraction > 0 ? t / forkFraction : 1
      angle = lerp(startAngle, targetAngle, easeInOutCubic(localT))
    } else {
      const envelopeT = rampEnd > forkFraction ? clamp((t - forkFraction) / (rampEnd - forkFraction), 0, 1) : 1
      const envelope = easeInOutCubic(envelopeT)
      const driftCap = Math.min(POST_FORK_DRIFT_MAX_RAD * lengthScale, lateralBudget / Math.max(radius, MIN_RADIUS_FOR_ANGLE_CAP))
      const drift = driftCap * envelope * Math.sin(curlFreq * t * Math.PI * 2 + curlPhase)
      // Unit 1c: a one-directional bend (not an oscillation like `drift`
      // above), ramped in by the same `envelope` so it starts at exactly 0
      // right where the fork's own turn ends (no kink) and grows smoothly
      // toward the tip -- see `RIM_CURL_CONTINUITY_LENGTH_FRACTION`'s doc
      // comment for why it's a length-proportional lateral budget rather
      // than a fixed angle.
      const rimCurlBudget = totalLength * RIM_CURL_CONTINUITY_LENGTH_FRACTION
      const rimCurlBias = rimCurl * RIM_CURL_DIRECTION * envelope * (rimCurlBudget / Math.max(radius, MIN_RADIUS_FOR_ANGLE_CAP))
      angle = targetAngle + drift + rimCurlBias
    }

    const y = randJitter(prng, Y_JITTER) * Math.sin(Math.PI * t)
    const thickness = Math.max(lerp(thicknessStart, thicknessEnd, t), 0.001)
    points.push({ position: polarToVec3(angle, radius, y), radius: thickness, time })
  }

  // Endpoint exact: the fork starts precisely on the parent's own real point
  // (or the spore's origin), never an approximation -- `distance <= 1e-6` is
  // a hard test requirement (item "fork start lies on parent").
  points[0] = { position: startPosition, radius: thicknessStart, time: splitTime }
  return points
}

function buildColonyRings(releases: ReleaseInfo[], bounds: TimeBounds, radiusForTime: (time: number) => number): GrowthRing[] {
  const rings: GrowthRing[] = []
  for (const release of releases) {
    const time = Date.parse(release.date)
    if (!Number.isFinite(time)) continue
    rings.push({
      id: `ring-release-${release.tag}`,
      kind: 'ring',
      ringKind: 'release',
      time,
      radius: radiusForTime(time),
      ref: { type: 'release', id: release.tag },
    })
  }

  // Faint calendar-year rings -- real elapsed time (Jan 1 boundaries within
  // the repo's own real lifetime), not fabricated data; non-interactive
  // (`ref: null`, excluded from `LookupableNetworkElement`), purely a
  // background growth-rate reference.
  if (bounds.lastEventTime > bounds.firstEventTime) {
    const startYear = new Date(bounds.firstEventTime).getUTCFullYear()
    const endYear = new Date(bounds.lastEventTime).getUTCFullYear()
    let count = 0
    for (let year = startYear + 1; year <= endYear && count < MAX_YEAR_RINGS; year++) {
      const time = Date.UTC(year, 0, 1)
      if (time <= bounds.firstEventTime || time >= bounds.lastEventTime) continue
      rings.push({ id: `ring-year-${year}`, kind: 'ring', ringKind: 'year', time, radius: radiusForTime(time), ref: null })
      count += 1
    }
  }

  rings.sort((a, b) => a.radius - b.radius)
  return rings
}

interface RadiusBinEntry {
  position: Vec3
  hyphaId: string
}

/** A coarse spatial grid keyed by disc-radius bin -- O(1)-ish nearest-neighbor fusion queries regardless of total hypha count (see the perf test). */
class RadiusGrid {
  private readonly bins = new Map<number, RadiusBinEntry[]>()

  private binIndex(radius: number): number {
    return Math.floor(radius / RADIUS_BIN_WIDTH)
  }

  insert(entry: RadiusBinEntry, radius: number): void {
    const index = this.binIndex(radius)
    const list = this.bins.get(index)
    if (list) list.push(entry)
    else this.bins.set(index, [entry])
  }

  nearby(radius: number, spread: number): RadiusBinEntry[] {
    const center = this.binIndex(radius)
    const out: RadiusBinEntry[] = []
    for (let i = center - spread; i <= center + spread; i++) {
      const list = this.bins.get(i)
      if (list) out.push(...list)
    }
    return out
  }
}

function nearestRingOrSpore(rings: GrowthRing[], radius: number, angle: number): { position: Vec3; kind: 'ring' | 'spore' } {
  let bestRadius = 0
  let bestKind: 'ring' | 'spore' = 'spore'
  let bestDiff = Math.abs(radius - 0)
  for (const ring of rings) {
    const diff = Math.abs(ring.radius - radius)
    if (diff < bestDiff) {
      bestDiff = diff
      bestRadius = ring.radius
      bestKind = 'ring'
    }
  }
  return { position: polarToVec3(angle, bestRadius, 0), kind: bestKind }
}

/**
 * Item 4: "connect with a short bridge to the nearest OTHER hypha point
 * within a small radius (<= 0.25); if none, just a small knot." When nothing
 * (hypha or ring/spore) is close enough, the bridge collapses to the tip
 * itself (zero length -- "just a knot"), still tagged with whichever
 * candidate was nominally closest for typing purposes.
 */
function findFusionAnchor(grid: RadiusGrid, selfHyphaId: string, tip: Vec3, radius: number, rings: GrowthRing[]): { position: Vec3; kind: 'hypha' | 'ring' | 'spore' } {
  let bestHypha: RadiusBinEntry | null = null
  let bestHyphaDist = Infinity
  for (const candidate of grid.nearby(radius, FUSION_SEARCH_BIN_SPREAD)) {
    if (candidate.hyphaId === selfHyphaId) continue
    const dist = Math.hypot(candidate.position.x - tip.x, candidate.position.z - tip.z)
    if (dist < bestHyphaDist) {
      bestHyphaDist = dist
      bestHypha = candidate
    }
  }

  const angle = Math.atan2(tip.z, tip.x)
  const ringFallback = nearestRingOrSpore(rings, radius, angle)
  const ringDist = Math.hypot(ringFallback.position.x - tip.x, ringFallback.position.z - tip.z)

  const useHypha = bestHypha !== null && bestHyphaDist <= ringDist
  const bestDist = useHypha ? bestHyphaDist : ringDist
  if (bestDist > FUSION_SEARCH_RADIUS) {
    return { position: tip, kind: useHypha ? 'hypha' : ringFallback.kind }
  }
  return useHypha ? { position: bestHypha!.position, kind: 'hypha' } : { position: ringFallback.position, kind: ringFallback.kind }
}

function pointOnHyphaAtFraction(points: HyphaPoint[], t: number): { position: Vec3; tangentAngle: number } {
  if (points.length === 1) return { position: points[0]!.position, tangentAngle: 0 }
  const clampedT = clamp(t, 0, 1)
  const scaled = clampedT * (points.length - 1)
  const indexLow = Math.min(points.length - 2, Math.floor(scaled))
  const localT = scaled - indexLow
  const a = points[indexLow]!
  const b = points[indexLow + 1]!
  const position = {
    x: a.position.x + (b.position.x - a.position.x) * localT,
    y: a.position.y + (b.position.y - a.position.y) * localT,
    z: a.position.z + (b.position.z - a.position.z) * localT,
  }
  const tangent = subVec3(b.position, a.position)
  return { position, tangentAngle: Math.atan2(tangent.z, tangent.x) }
}

function rotateAroundY(v: Vec3, angleRadians: number): Vec3 {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return vec3(v.x * cos - v.z * sin, v.y, v.x * sin + v.z * cos)
}

/**
 * Item 3: "Commits = hairs along their hypha, placed by commit order evenly
 * along the path (not by time)". Uses `pointOnHyphaAtFraction` (index-based)
 * rather than `pointOnHyphaAtTime` -- deliberately ignores each commit's own
 * real timestamp for *positioning* (only its order matters), since the
 * hypha's own length is now work-driven, not time-driven, so a strict
 * time-interpolated placement would bunch commits unevenly again.
 */
function buildOrderedCommitElements(hypha: Hypha, commits: HyphaCommitDraft[], prng: Prng): { nodes: NetworkNode[]; hairs: Hair[] } {
  const nodes: NetworkNode[] = []
  const hairs: Hair[] = []
  const baseThickness = radiusForCommitCount(hypha.commitCount)

  commits.forEach((commit, index) => {
    const t = commits.length === 1 ? 0.5 : index / (commits.length - 1)
    const at = pointOnHyphaAtFraction(hypha.points, t)
    const nodeId = `node-${hypha.id}-${commit.ref.type}-${commit.ref.id}`
    const thickness = Math.max(baseThickness * (1 - t * 0.4), 0.004)
    nodes.push({ id: nodeId, kind: 'node', hyphaId: hypha.id, time: commit.time, ref: commit.ref, position: at.position, radius: thickness, isMergePoint: commit.isMergePoint })

    const perp = vec3(-Math.sin(at.tangentAngle), 0, Math.cos(at.tangentAngle))
    const sideSign = index % 2 === 0 ? 1 : -1
    const angleJitter = randJitter(prng, HAIR_ANGLE_JITTER)
    const direction = rotateAroundY(perp, angleJitter * sideSign)

    const lengthBase = clamp(thickness * HAIR_LENGTH_FACTOR, HAIR_LENGTH_MIN, HAIR_LENGTH_MAX)
    const jittered = lengthBase + randJitter(prng, HAIR_LENGTH_JITTER)
    const length = Math.max(HAIR_MIN_LENGTH_FLOOR, jittered) * (commit.isMergePoint ? HAIR_MERGE_LENGTH_BOOST : 1)

    hairs.push({
      id: `hair-${nodeId}`,
      kind: 'hair',
      hyphaId: hypha.id,
      nodeId,
      time: commit.time,
      ref: commit.ref,
      position: at.position,
      direction,
      length,
      baseRadius: Math.max(thickness * HAIR_BASE_RADIUS_FRACTION, HAIR_MIN_BASE_RADIUS),
    })
  })

  return { nodes, hairs }
}

/** A genuine direct commit on `main` -- excludes the merge-point pseudo-entries `topology.ts` also records there (those already get their own PR hypha's fusion knot). */
function isGenuineDirectCommit(c: HyphaCommitDraft): boolean {
  return c.ref.type === 'commit' && !c.isMergePoint
}

/**
 * Item 3: "Direct commits to the default branch = short hairs radiating from
 * the spore/nearest hypha at r(t)." Reuses the same gap-filling angle search
 * as a full hypha (against the FINAL placed-hyphae set, since spurs are pure
 * decoration and never influence other hyphae's own placement).
 */
function buildDirectCommitSpurs(main: HyphaDraft, placedHyphae: Hypha[], sporeRays: number[], radiusForTime: (time: number) => number, seed: string): { nodes: NetworkNode[]; hairs: Hair[] } {
  const directCommits = main.commits.filter(isGenuineDirectCommit)
  if (directCommits.length === 0) return { nodes: [], hairs: [] }

  const prng = createPrng(`${seed}:network-colony-spurs`)
  const nodes: NetworkNode[] = []
  const hairs: Hair[] = []

  for (const commit of directCommits) {
    const radius = radiusForTime(commit.time)
    const spanning = computeSpanning(placedHyphae, radius)
    const angles = [...spanning.map((s) => s.angleAtR0), ...sporeRays]
    const angle = pickAngleInLargestGap(angles, prng, SPUR_GAP_JITTER_FRACTION)
    const position = polarToVec3(angle, radius, 0)
    const nodeId = `node-${main.id}-commit-${commit.ref.id}`
    nodes.push({ id: nodeId, kind: 'node', hyphaId: main.id, time: commit.time, ref: commit.ref, position, radius: 0.006, isMergePoint: false })

    const direction = vec3(Math.cos(angle), 0, Math.sin(angle))
    const length = clamp(SPUR_LENGTH_MIN + randJitter(prng, SPUR_LENGTH_JITTER) + (SPUR_LENGTH_MAX - SPUR_LENGTH_MIN) * logScale(radius, 0, DISC_MAX_RADIUS), SPUR_LENGTH_MIN * 0.5, SPUR_LENGTH_MAX)
    hairs.push({
      id: `hair-${nodeId}`,
      kind: 'hair',
      hyphaId: main.id,
      nodeId,
      time: commit.time,
      ref: commit.ref,
      position,
      direction,
      length,
      baseRadius: Math.max(0.006 * SPUR_BASE_RADIUS_FRACTION, SPUR_MIN_BASE_RADIUS),
    })
  }

  return { nodes, hairs }
}

export interface ColonyLayoutResult {
  spore: Spore
  hyphae: Hypha[]
  nodes: NetworkNode[]
  tips: Tip[]
  hairs: Hair[]
  rings: GrowthRing[]
  fusions: Fusion[]
  mushrooms: Mushroom[]
  nodesOmittedByHypha: Record<string, number>
}

// --- Galaxy swirl ----------------------------------------------------------
// Product direction: bend the colony's radial growth into spiral-galaxy arms
// (bright filaments radiating from the spore, curving as they reach out) --
// a purely cosmetic rotation, applied as the very last step so it never
// touches the growth algorithm's own invariants (gap-filling, fork
// continuity, length bounds): every spatial element gets rotated around Y by
// the SAME radius-dependent angle, so two elements that were exactly
// coincident (or at the same disc radius) before swirl stay exactly
// coincident (or at the same relative angle) after it. Disc radius itself --
// the real time/work encoding -- is preserved exactly for every point.

/** Extra rotation (radians) at disc radius `radius`, ramping from 0 at the spore to `swirl` at the outer rim (`DISC_MAX_RADIUS`). */
export function swirlAngleForRadius(radius: number, swirl: number, power: number): number {
  if (swirl === 0 || radius <= 0) return 0
  const frac = clamp(radius / DISC_MAX_RADIUS, 0, 1)
  return swirl * frac ** power
}

/** Rotates `position` around Y by `swirlAngleForRadius(discRadius(position), ...)`. A no-op at the spore (radius 0 has no defined angle) or when `swirl` is 0. */
export function applySwirlToPosition(position: Vec3, swirl: number, power: number): Vec3 {
  const radius = discRadius(position)
  if (radius < 1e-9 || swirl === 0) return position
  const angle = Math.atan2(position.z, position.x) + swirlAngleForRadius(radius, swirl, power)
  return { x: Math.cos(angle) * radius, y: position.y, z: Math.sin(angle) * radius }
}

/** Inverse of `applySwirlToPosition` -- recovers the pre-swirl position. Used by tests to check the underlying growth algorithm's own geometric invariants independent of the swirl cosmetic layer. */
export function unswirlPosition(position: Vec3, swirl: number, power: number): Vec3 {
  const radius = discRadius(position)
  if (radius < 1e-9 || swirl === 0) return position
  const angle = Math.atan2(position.z, position.x) - swirlAngleForRadius(radius, swirl, power)
  return { x: Math.cos(angle) * radius, y: position.y, z: Math.sin(angle) * radius }
}

/**
 * Removes a sharp zigzag/hook from a FINAL (post-swirl) hypha polyline by
 * pulling any interior point whose turn exceeds `MAX_HYPHA_TURN_RAD` back
 * onto the smooth path its own immediate neighbors already describe -- see
 * `MAX_HYPHA_TURN_RAD`'s doc comment for the root cause this closes. Only
 * the offending point's ANGLE moves (to the angular midpoint of its two
 * neighbors, via `shortestAngleTo` so it takes the short way around);
 * radius, height and time are left untouched, so every OTHER invariant
 * (monotonic radius, timing, per-point thickness/taper) still holds
 * exactly. Endpoints (the real fork-start attach point, and the tip) are
 * never touched -- both are hard invariants elsewhere (exact parent
 * position, exact final radius/time). Multiple passes: a single point can
 * be an outlier only relative to ANOTHER point that itself only gets fixed
 * in a later pass (a short run of consecutive outliers).
 */
function relaxSharpTurns(points: HyphaPoint[]): HyphaPoint[] {
  if (points.length < 3) return points
  const relaxed = points.map((point) => ({ ...point }))

  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < relaxed.length - 1; i++) {
      const a = relaxed[i - 1]!.position
      const b = relaxed[i]!.position
      const c = relaxed[i + 1]!.position
      const v1x = b.x - a.x
      const v1z = b.z - a.z
      const v2x = c.x - b.x
      const v2z = c.z - b.z
      const len1 = Math.hypot(v1x, v1z)
      const len2 = Math.hypot(v2x, v2z)
      if (len1 < 1e-9 || len2 < 1e-9) continue
      const cosTurn = clamp((v1x * v2x + v1z * v2z) / (len1 * len2), -1, 1)
      if (Math.acos(cosTurn) <= MAX_HYPHA_TURN_RAD) continue

      const angleA = Math.atan2(a.z, a.x)
      const angleC = Math.atan2(c.z, c.x)
      // Midpoint angle between the two (untouched) neighbors -- `shortestAngleTo`
      // re-expresses `angleC` as `angleA` plus the shortest signed delta, so
      // halving that delta averages the short way around the circle, never
      // the long way.
      const shortestDelta = shortestAngleTo(angleA, angleC) - angleA
      const midpointAngle = angleA + shortestDelta / 2
      const radius = discRadius(b)
      relaxed[i] = { ...relaxed[i]!, position: polarToVec3(midpointAngle, radius, b.y) }
    }
  }
  return relaxed
}

/**
 * Applies the swirl to every spatial element of a colony result, uniformly
 * (P7: picking and rendering both read this one already-swirled model, so
 * they can never disagree). A hair's direction/length are recomputed from
 * its independently-swirled base and tip -- its two ends can sit at
 * slightly different disc radii, so they rotate by slightly different
 * amounts, an honest consequence of swirling a real 3D segment rather than
 * an approximation.
 */
/**
 * T10 (second-pass rim fix). A NORMAL (non-spore-started) hypha's own radial
 * span can never exceed `COLONY_LENGTH_MAX` -- see the `nominalEndRadius`
 * comment at the layout call site: only a spore-started hypha's span can
 * legitimately reach `COLONY_RADIUS_CAP`. For every hypha at or under that
 * span, independently swirling each point by ITS OWN radius (the general
 * `applySwirlToPosition`) bends an otherwise near-straight short strand into
 * a visible curve, because `swirlAngleForRadius`'s rate of change with
 * radius is LARGEST right near the rim (power=1.4 > 1 makes the curve
 * convex, steepest at `DISC_MAX_RADIUS`) -- exactly where these short
 * hyphae's own real attach points cluster. Measured on the express fixture
 * (`scripts/diagnose-rim.ts`, not committed): even after both the width and
 * post-fork-wiggle fixes above, a rim hypha's max lateral deviation from its
 * own base->tip straight chord was still up to ~31% of its own length --
 * visually a hook, not a taper -- while its own GROWTH invariants
 * (`maxTurnRadians`, the lateral wiggle budget) were already tiny; the extra
 * bend came entirely from the swirl post-process, not from growth.
 *
 * Fix: rotate every point belonging to such a hypha -- and every node/hair/
 * tip/fusion attached to it -- by ONE FIXED angle (the swirl angle at the
 * hypha's own real attach-point radius, so it still lands exactly on its
 * parent's independently-swirled position) instead of each point's own
 * radius-based angle. A rigid rotation of an already near-straight pre-swirl
 * curve stays near-straight. Only a genuinely long, spore-started arm
 * (span > `COLONY_LENGTH_MAX`) keeps the per-point independent swirl that
 * produces the intended "spiral galaxy arm" curve -- that population is the
 * only one the swirl's visible meander was ever meant to bend (see
 * `growHyphaPoints`'s `lengthScale` comment). The degenerate `main` stub
 * (both its points sit at the spore, `kind === 'main'`) is excluded: its id
 * is also used by the direct-commit spurs (`buildDirectCommitSpurs`), which
 * are real, scattered-radius elements that must keep their own independent
 * per-point swirl, not inherit the main stub's (always-zero, spore-radius)
 * angle.
 */
function rigidSwirlAngleByHyphaId(hyphae: Hypha[], swirl: number, power: number): Map<string, number> {
  const byId = new Map<string, number>()
  for (const hypha of hyphae) {
    if (hypha.kind === 'main' || hypha.points.length === 0) continue
    const first = hypha.points[0]!.position
    const last = hypha.points[hypha.points.length - 1]!.position
    const span = discRadius(last) - discRadius(first)
    if (span > COLONY_LENGTH_MAX) continue
    const startRadius = discRadius(first)
    byId.set(hypha.id, startRadius < 1e-9 ? 0 : swirlAngleForRadius(startRadius, swirl, power))
  }
  return byId
}

export function applySwirl(result: ColonyLayoutResult, swirl: number, power: number): ColonyLayoutResult {
  if (swirl === 0) return result
  const at = (p: Vec3): Vec3 => applySwirlToPosition(p, swirl, power)
  const rigidAngleByHyphaId = rigidSwirlAngleByHyphaId(result.hyphae, swirl, power)
  const swirlFor = (hyphaId: string, p: Vec3): Vec3 => {
    const rigidAngle = rigidAngleByHyphaId.get(hyphaId)
    return rigidAngle === undefined ? at(p) : rotateAroundY(p, rigidAngle)
  }

  const hyphae = result.hyphae.map((hypha) => ({
    ...hypha,
    points: hypha.points.map((point) => ({ ...point, position: swirlFor(hypha.id, point.position) })),
  }))
  const nodes = result.nodes.map((node) => ({ ...node, position: swirlFor(node.hyphaId, node.position) }))
  const tips = result.tips.map((tip) => ({ ...tip, position: swirlFor(tip.hyphaId, tip.position) }))
  const mushrooms = result.mushrooms.map((mushroom) => ({ ...mushroom, position: at(mushroom.position) }))
  // Rim-artifact fix (T9): unlike a hair (tiny, its two ends' independent
  // swirl amounts differ negligibly), a fusion "anastomosis bridge" is
  // capped at a real `FUSION_SEARCH_RADIUS` (0.25) but its two ends
  // (`position`, the hypha's real tip, and `bridgeTo`, a nearby hypha/ring/
  // spore point) can sit at MEANINGFULLY different disc radii, especially
  // near the rim where a bridge often reaches inward to an already-placed
  // neighbor. Independently re-deriving each end's own radius-based swirl
  // (the old `at(fusion.bridgeTo)`) rotates the two ends by different
  // amounts, stretching a bridge that was bounded at 0.25 pre-swirl into a
  // visibly longer, oddly-angled chord post-swirl (confirmed up to ~0.37 on
  // the express fixture, `diagnose-rim.ts`). Rotating `bridgeTo` by the
  // SAME angle as its own tip (a rigid attach, not an independent swirl)
  // preserves the pre-swirl bridge length/angle exactly, matching the
  // "short bridge" invariant `findFusionAnchor` already enforces. T10: when
  // the tip's OWN hypha is short enough to use a rigid swirl angle, reuse
  // that exact angle for `bridgeTo` too, instead of re-deriving one from the
  // tip's own radius, so the bridge keeps tracking its (now rigidly rotated)
  // tip exactly.
  const fusions = result.fusions.map((fusion) => {
    const rigidAngleForHypha = rigidAngleByHyphaId.get(fusion.hyphaId)
    const position = swirlFor(fusion.hyphaId, fusion.position)
    const tipRadius = discRadius(fusion.position)
    const bridgeAngle = rigidAngleForHypha ?? (tipRadius < 1e-9 ? 0 : swirlAngleForRadius(tipRadius, swirl, power))
    return { ...fusion, position, bridgeTo: rotateAroundY(fusion.bridgeTo, bridgeAngle) }
  })
  const hairs = result.hairs.map((hair) => {
    const rigidAngle = rigidAngleByHyphaId.get(hair.hyphaId)
    if (rigidAngle !== undefined) {
      // Exact: a rigid rotation preserves the hair's own length precisely,
      // unlike the independent-per-point path below (which recomputes
      // length from two separately-swirled ends and so can drift slightly).
      return { ...hair, position: rotateAroundY(hair.position, rigidAngle), direction: rotateAroundY(hair.direction, rigidAngle) }
    }
    const base = at(hair.position)
    const tip = at(addVec3(hair.position, scaleVec3(hair.direction, hair.length)))
    const delta = subVec3(tip, base)
    const length = vec3Length(delta)
    const direction = normalizeVec3(delta, hair.direction)
    return { ...hair, position: base, direction, length }
  })

  return {
    ...result,
    spore: { ...result.spore, position: at(result.spore.position) },
    hyphae,
    nodes,
    tips,
    mushrooms,
    fusions,
    hairs,
  }
}

/**
 * Builds the colony layout from the shared topology (`topology.ts`'s
 * `HyphaDraft`s), processing hyphae in split-time order (item 2) so every
 * later hypha's gap search and parent search see everything placed so far.
 * Deterministic for a fixed seed. See the module doc above for the mapping.
 */
/**
 * Opt-in, zero-cost-when-omitted instrumentation (B3/T8): lets a test count
 * the algorithm's own dominant per-hypha operation (`computeSpanning`'s scan
 * over every already-placed hypha) instead of measuring wall-clock time,
 * which is flaky under CI/parallel-worker load (see `buildNetwork.test.ts`'s
 * performance suite, which replaced a `performance.now()` budget with this).
 * Never used by production code -- `buildNetwork` never passes it.
 */
export interface ColonyLayoutInstrumentation {
  /** Called once per hypha placed, with how many already-placed hyphae the placement step's spanning search just scanned. */
  onSpanningScan: (scannedCount: number) => void
}

export function layoutNetworkColony(
  main: HyphaDraft,
  hyphae: HyphaDraft[],
  bounds: TimeBounds,
  seed: string,
  releases: ReleaseInfo[],
  options: Partial<LayoutOptions> = {},
  instrumentation?: ColonyLayoutInstrumentation,
): ColonyLayoutResult {
  const resolved: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options }
  const prng = createPrng(`${seed}:network-colony-layout`)
  const radiusForTime = (time: number): number => radiusForFrac(timeToFrac(time, bounds))

  const spore: Spore = { id: 'spore', kind: 'spore', time: bounds.firstEventTime, ref: main.ref, position: vec3(0, 0, 0) }
  const rings = buildColonyRings(releases, bounds, radiusForTime)

  // Colony has no rendered main curve (the disc/rings/spore ARE the colony)
  // -- this degenerate 2-point entry exists only so `main` stays a
  // lookupable `Hypha` (branch detail, id `hypha-main`), like the spiral
  // layout, not to be drawn as a line.
  const mainHypha: Hypha = {
    id: main.id,
    kind: 'main',
    ref: main.ref,
    time: main.splitTime,
    parentHyphaId: null,
    splitTime: main.splitTime,
    endTime: main.endTime,
    status: 'open',
    points: [
      { position: spore.position, radius: 0.01, time: bounds.firstEventTime },
      { position: spore.position, radius: 0.01, time: bounds.lastEventTime },
    ],
    lane: 0,
    side: 0,
    commitCount: main.commitCount,
    attachment: null,
  }

  const positionedById = new Map<string, Hypha>([[main.id, mainHypha]])
  const placedHyphae: Hypha[] = []
  const fusionGrid = new RadiusGrid()

  const sporeRayOffset = randRange(prng, 0, (Math.PI * 2) / SPORE_RAY_COUNT)
  const sporeRays = Array.from({ length: SPORE_RAY_COUNT }, (_, i) => sporeRayOffset + (i * Math.PI * 2) / SPORE_RAY_COUNT)

  const orderedDrafts = [...hyphae].sort((a, b) => a.splitTime - b.splitTime || a.id.localeCompare(b.id))

  const nodes: NetworkNode[] = []
  const tips: Tip[] = []
  const fusions: Fusion[] = []
  const hairs: Hair[] = []
  const nodesOmittedByHypha: Record<string, number> = {}
  const hairPrng = createPrng(`${seed}:network-colony-hairs`)

  for (const draft of orderedDrafts) {
    const r0 = radiusForTime(draft.splitTime)
    instrumentation?.onSpanningScan(placedHyphae.length)
    const spanning = computeSpanning(placedHyphae, r0)
    const targetAngleRaw = chooseTargetAngle(spanning, sporeRays, placedHyphae, prng)

    const workLength = computeWorkLength(draft.commitCount, draft.workLines)
    const length = draft.status === 'dead_end' ? workLength * COLONY_CLOSED_LENGTH_MULTIPLIER : workLength

    // Item 2d: real branch-from-branch topology wins outright; otherwise
    // attach to whichever already-spanning hypha's own angle at r0 is
    // closest to the target -- BUT ONLY if that neighbor is close enough for
    // a natural fork (`maxTurnRadians`); otherwise (nothing spans r0 yet, OR
    // the closest one is still too far) sprout fresh from the spore. Round 3
    // finding: without this "too far -> spore" fallback, clamping the turn
    // toward whichever neighbor happened to be closest permanently glued
    // every new hypha to the SAME single already-populated arc (the closest
    // spanning neighbor is unavoidably IN that arc once any real structure
    // exists at all, so a plain clamp can never let growth reach a distant
    // real gap) -- the disc never filled past one crescent. The spore
    // fallback lets growth actually break away and seed real coverage
    // elsewhere (its reach now properly uses `r0`, not a fixed short stub --
    // see the `nominalEndRadius` comment below). The START POSITION is
    // always this real point (or the spore's origin); `growHyphaPoints`
    // derives its own starting direction from that position (never a
    // separate tangent -- see its doc comment for why).
    const isBranchFromBranch = draft.parentHyphaId !== null && draft.parentHyphaId !== main.id
    let startPosition: Vec3
    let attachment: 'colony' | 'parent-branch'
    let startedAtSpore = false

    if (isBranchFromBranch) {
      const parentHypha = positionedById.get(draft.parentHyphaId!) ?? mainHypha
      startPosition = pointOnHyphaAtRadius(parentHypha.points, r0).position
      attachment = 'parent-branch'
    } else {
      const closest = closestSpanningByAngle(spanning, targetAngleRaw)
      const naturalFit = closest !== null && angularDistance(closest.angleAtR0, targetAngleRaw) <= maxTurnRadians(r0, length, FORK_LATERAL_BUDGET_FRACTION)
      if (naturalFit) {
        startPosition = pointOnHyphaAtRadius(closest!.hypha.points, r0).position
      } else {
        startPosition = spore.position
        startedAtSpore = true
      }
      attachment = 'colony'
    }

    const startRadius = discRadius(startPosition)
    // Item 2e: "grow ... outward to r_end = r0 + L_h" -- r0 (real, time-based)
    // is the reference, not the literal rendered start radius. For a real
    // attach point this is nearly the same thing (`startRadius` was found
    // AT r0). But a hypha that starts at the SPORE (nothing spans r0 yet --
    // typically seeding a genuinely new angular region) has a `startRadius`
    // of 0 regardless of how large r0 itself is; using `startRadius + length`
    // there (round 2's first attempt) capped every such hypha's reach at
    // `COLONY_LENGTH_MAX` (~1.4) regardless of r0, so it could never extend
    // far enough to seed real coverage at its own actual radius -- once a
    // region's growth fell back to the spore once, every later hypha in
    // that same region kept re-falling back to a short center-hugging stub
    // (nothing ever spanned that radius there), collapsing the whole colony
    // into whichever single arc already had real structure (the crescent
    // shape from round 2's own images). Using `r0 + length` here instead
    // lets a spore-started hypha actually reach out to roughly its own real
    // radius, so it can anchor further real growth in that region.
    const nominalEndRadius = startedAtSpore ? r0 + length : startRadius + length
    // `COLONY_RADIUS_CAP` (round 2 orchestrator feedback: keep the disc
    // round) is the soft target -- `softenRimOvershoot` (Unit 1b of the
    // final polish pass) lets a hypha that wants to reach much farther than
    // the cap keep a fraction of that extra reach instead of every
    // overshooting hypha collapsing onto the exact same radius (see its own
    // doc comment). `Math.max(startRadius, ...)` keeps it monotonic even for
    // a hypha whose own `startRadius` is already past the cap (a rare
    // compounding-chain edge case).
    const endRadius = Math.max(startRadius, softenRimOvershoot(nominalEndRadius, COLONY_RADIUS_CAP))

    // Unit 1c of the final polish pass ("rim growth front"): a hypha whose
    // split time falls in the trailing `RECENT_GROWTH_FRACTION` of history
    // (see `renderHints.ts`) gets a small seeded lateral curvature bias so
    // it visually continues the arm it grows from instead of pointing
    // straight out radially -- see `growHyphaPoints`'s own `rimCurl` use and
    // `RIM_CURL_DIRECTION`'s doc comment for why this does NOT read the
    // actual `resolved.swirl` value (growth must stay swirl-config-
    // independent).
    const rimCurl = recentGrowthFactor(draft.splitTime, bounds)

    const points = growHyphaPoints({
      startPosition,
      startRadius,
      targetAngleRaw,
      endRadius,
      splitTime: draft.splitTime,
      endTime: draft.endTime,
      commitCount: draft.commitCount,
      status: draft.status,
      prng,
      rimCurl,
    })

    const hypha: Hypha = {
      id: draft.id,
      kind: draft.kind,
      ref: draft.ref,
      time: draft.splitTime,
      parentHyphaId: draft.parentHyphaId,
      splitTime: draft.splitTime,
      endTime: draft.endTime,
      status: draft.status,
      points,
      lane: 0,
      side: 0,
      commitCount: draft.commitCount,
      attachment,
    }
    positionedById.set(draft.id, hypha)
    placedHyphae.push(hypha)
    for (const point of points) fusionGrid.insert({ position: point.position, hyphaId: draft.id }, discRadius(point.position))

    const { kept, omitted } = capEvenly(draft.commits, resolved.maxNodesPerHypha)
    if (omitted > 0) nodesOmittedByHypha[draft.id] = omitted
    const ordered = buildOrderedCommitElements(hypha, kept, hairPrng)
    nodes.push(...ordered.nodes)
    hairs.push(...ordered.hairs)

    if (draft.status === 'fused') {
      const tipPoint = points[points.length - 1]!
      const tipRadius = discRadius(tipPoint.position)
      const bridge = findFusionAnchor(fusionGrid, draft.id, tipPoint.position, tipRadius, rings)
      fusions.push({
        id: `fusion-${draft.id}`,
        kind: 'fusion',
        hyphaId: draft.id,
        time: draft.endTime,
        ref: draft.ref,
        position: tipPoint.position,
        bridgeTo: bridge.position,
        bridgeToKind: bridge.kind,
      })
    } else if (draft.status === 'open') {
      const tipPoint = points[points.length - 1]!
      tips.push({ id: `tip-${draft.id}`, kind: 'tip', hyphaId: draft.id, time: tipPoint.time, ref: draft.ref, position: tipPoint.position })
    }
  }

  const spurs = buildDirectCommitSpurs(main, placedHyphae, sporeRays, radiusForTime, seed)
  nodes.push(...spurs.nodes)
  hairs.push(...spurs.hairs)

  const mushrooms = buildMushroomsOnRings(releases, radiusForTime, placedHyphae, seed)

  const built: ColonyLayoutResult = {
    spore,
    hyphae: [mainHypha, ...placedHyphae],
    nodes,
    tips,
    hairs,
    rings,
    fusions,
    mushrooms,
    nodesOmittedByHypha,
  }
  // The galaxy swirl is the very last step (see its own doc above) -- every
  // invariant above this line (gap-filling, fork continuity, work-based
  // length, real data links) is established on the pre-swirl geometry.
  const swirled = applySwirl(built, resolved.swirl, resolved.swirlPower)
  // Rim-artifact fix (T9): `relaxSharpTurns` runs AFTER swirl, unconditionally
  // (not just when `swirl !== 0`) -- the fork+swirl interaction is the most
  // common cause, but this is a general "no polyline turn > 60deg" invariant
  // (see `MAX_HYPHA_TURN_RAD`'s doc comment), not a swirl-specific patch.
  return { ...swirled, hyphae: swirled.hyphae.map((hypha) => ({ ...hypha, points: relaxSharpTurns(hypha.points) })) }
}
