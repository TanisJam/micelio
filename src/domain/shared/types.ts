/**
 * Metaphor-agnostic pure types shared by every domain layout (currently just
 * the mycelium network, `../network/`) -- moved out of the removed
 * `../tree/` module in M4 so nothing left still depends on tree-specific
 * code for genuinely generic primitives.
 */

/** The first/last dated-event epoch-ms span a repository snapshot covers -- drives both radius-from-time mappings and the growth-replay scrubber. */
export interface TimeBounds {
  firstEventTime: number
  lastEventTime: number
}
