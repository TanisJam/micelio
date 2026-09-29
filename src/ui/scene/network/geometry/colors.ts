import * as THREE from 'three'
import type { HyphaKind } from '../../../../domain/network'
import { hexToRgb, mixHex } from '../../../theme/color'
import { mycelium } from '../../../theme/tokens'

/**
 * Pure color helpers for the mycelium scene (P1's tokenized palette).
 * `hexToVec3` is the only three.js touchpoint (a plain 3-number container),
 * kept here rather than in `theme/color.ts` so that module can stay
 * three-free.
 */

export function hexToVec3(hex: string): THREE.Vector3 {
  const { r, g, b } = hexToRgb(hex)
  return new THREE.Vector3(r / 255, g / 255, b / 255)
}

/** Base -> tip color pair for a hypha kind (P1: active cool cyan, dead dry brown, open/live brightest). */
export function hyphaColorStops(kind: HyphaKind): [string, string] {
  switch (kind) {
    case 'closed':
      return [mycelium.hyphaDeadBase, mycelium.hyphaDeadTip]
    case 'open':
    case 'liveBranch':
      return [mycelium.hyphaActiveTip, mycelium.hyphaOpen]
    case 'merged':
    default:
      return [mycelium.hyphaActiveBase, mycelium.hyphaActiveTip]
  }
}

/** Interpolated color (hex) at fraction `t` (0 = base, 1 = tip) along a hypha of the given kind. */
export function hyphaColorAt(kind: HyphaKind, t: number): string {
  const [base, tip] = hyphaColorStops(kind)
  return mixHex(base, tip, t)
}
