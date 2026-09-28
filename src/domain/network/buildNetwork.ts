import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { addVec3, scaleVec3, vec3Length } from '../tree/vector'
import { layoutNetworkColony } from './colonyLayout'
import { DEFAULT_LAYOUT_OPTIONS, layoutNetwork, type LayoutOptions } from './layout'
import { buildMushrooms } from './mushrooms'
import { buildHyphaTopology, DEFAULT_TOPOLOGY_OPTIONS, type TopologyOptions } from './topology'
import type { Fusion, GrowthRing, HyphaKind, NetworkLayoutMode, NetworkModel, NetworkOverflow, NetworkSummary } from './types'

/**
 * Builds the full deterministic `NetworkModel` (mycelium topology + layout +
 * mushrooms) from a `RepoSnapshot`. Pure -- no React, no three.js. This is
 * the network-metaphor counterpart of `../tree/buildTree`.
 *
 * Two layout strategies share the same `topology.ts` DAG: the original
 * `'spiral'` (default, M2/M2b) and the `'colony'` prototype (M2c, see
 * `colonyLayout.ts`) -- pass `{ layout: 'colony' }` to compare them.
 */

export interface NetworkBuildOptions extends TopologyOptions, LayoutOptions {
  layout: NetworkLayoutMode
}

export const DEFAULT_NETWORK_BUILD_OPTIONS: NetworkBuildOptions = {
  ...DEFAULT_TOPOLOGY_OPTIONS,
  ...DEFAULT_LAYOUT_OPTIONS,
  layout: 'spiral',
}

const HYPHA_KINDS: HyphaKind[] = ['main', 'merged', 'closed', 'open', 'liveBranch']

export function buildNetwork(snapshot: RepoSnapshot, options: Partial<NetworkBuildOptions> = {}): NetworkModel {
  const resolved: NetworkBuildOptions = { ...DEFAULT_NETWORK_BUILD_OPTIONS, ...options }
  const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
  const bounds = computeTimeBounds(snapshot)

  const topology = buildHyphaTopology(snapshot, bounds, resolved)

  const rings: GrowthRing[] = []
  const fusions: Fusion[] = []
  let layoutHyphae, layoutNodes, layoutTips, layoutHairs, layoutSpore, mushrooms, nodesOmittedByHypha

  if (resolved.layout === 'colony') {
    const colony = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, resolved)
    layoutHyphae = colony.hyphae
    layoutNodes = colony.nodes
    layoutTips = colony.tips
    layoutHairs = colony.hairs
    layoutSpore = colony.spore
    mushrooms = colony.mushrooms
    nodesOmittedByHypha = colony.nodesOmittedByHypha
    rings.push(...colony.rings)
    fusions.push(...colony.fusions)
  } else {
    const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed, resolved)
    const mainHypha = layout.hyphae.find((hypha) => hypha.id === topology.main.id)
    layoutHyphae = layout.hyphae
    layoutNodes = layout.nodes
    layoutTips = layout.tips
    layoutHairs = layout.hairs
    layoutSpore = layout.spore
    mushrooms = buildMushrooms(snapshot.releases, mainHypha?.points ?? [], seed)
    nodesOmittedByHypha = layout.nodesOmittedByHypha
  }

  let maxRadius = 0
  for (const hypha of layoutHyphae) {
    for (const point of hypha.points) {
      const radius = vec3Length(point.position)
      if (radius > maxRadius) maxRadius = radius
    }
  }
  for (const mushroom of mushrooms) {
    const radius = vec3Length(mushroom.position)
    if (radius > maxRadius) maxRadius = radius
  }
  for (const hair of layoutHairs) {
    const tip = addVec3(hair.position, scaleVec3(hair.direction, hair.length))
    const radius = vec3Length(tip)
    if (radius > maxRadius) maxRadius = radius
  }
  for (const ring of rings) {
    if (ring.radius > maxRadius) maxRadius = ring.radius
  }
  for (const fusion of fusions) {
    const bridgeRadius = vec3Length(fusion.bridgeTo)
    if (bridgeRadius > maxRadius) maxRadius = bridgeRadius
  }

  const hyphaCountByKind = Object.fromEntries(HYPHA_KINDS.map((kind) => [kind, 0])) as Record<HyphaKind, number>
  for (const hypha of layoutHyphae) hyphaCountByKind[hypha.kind] += 1

  const summary: NetworkSummary = {
    hyphaCountByKind,
    nodeCount: layoutNodes.length,
    mushroomCount: mushrooms.length,
    hairCount: layoutHairs.length,
    fusionCount: fusions.length,
  }

  const overflow: NetworkOverflow = {
    hyphaeOmitted: topology.hyphaeOmitted,
    nodesOmittedByHypha,
  }

  return {
    seed,
    layout: resolved.layout,
    bounds: { time: bounds, radius: maxRadius },
    spore: layoutSpore,
    hyphae: layoutHyphae,
    nodes: layoutNodes,
    tips: layoutTips,
    mushrooms,
    hairs: layoutHairs,
    rings,
    fusions,
    overflow,
    summary,
  }
}
