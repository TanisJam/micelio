import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../shared/timeBounds'
import { addVec3, scaleVec3, vec3Length } from '../shared/vector'
import { layoutNetworkColony } from './colonyLayout'
import { DEFAULT_LAYOUT_OPTIONS, type LayoutOptions } from './ringGeometry'
import { buildHyphaTopology, DEFAULT_TOPOLOGY_OPTIONS, type TopologyOptions } from './topology'
import type { Fusion, GrowthRing, HyphaKind, NetworkModel, NetworkOverflow, NetworkSummary } from './types'

/**
 * Builds the full deterministic `NetworkModel` (mycelium topology + colony
 * layout + mushrooms) from a `RepoSnapshot`. Pure -- no React, no three.js.
 *
 * M4 removed the earlier `'spiral'` layout (M2/M2b) once the `'colony'`
 * layout (M2c/M2d, see `colonyLayout.ts`) fully superseded it as the
 * product's only mycelium visualization -- both shared the same
 * `topology.ts` DAG.
 */

export interface NetworkBuildOptions extends TopologyOptions, LayoutOptions {}

export const DEFAULT_NETWORK_BUILD_OPTIONS: NetworkBuildOptions = {
  ...DEFAULT_TOPOLOGY_OPTIONS,
  ...DEFAULT_LAYOUT_OPTIONS,
}

const HYPHA_KINDS: HyphaKind[] = ['main', 'merged', 'closed', 'open', 'liveBranch', 'direct']

export function buildNetwork(snapshot: RepoSnapshot, options: Partial<NetworkBuildOptions> = {}): NetworkModel {
  const resolved: NetworkBuildOptions = { ...DEFAULT_NETWORK_BUILD_OPTIONS, ...options }
  const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
  const bounds = computeTimeBounds(snapshot)

  const topology = buildHyphaTopology(snapshot, bounds, resolved)

  const colony = layoutNetworkColony(topology.main, topology.hyphae, bounds, seed, snapshot.releases, resolved)
  const layoutHyphae = colony.hyphae
  const layoutNodes = colony.nodes
  const layoutTips = colony.tips
  const layoutHairs = colony.hairs
  const layoutSpore = colony.spore
  const mushrooms = colony.mushrooms
  const nodesOmittedByHypha = colony.nodesOmittedByHypha
  const rings: GrowthRing[] = [...colony.rings]
  const fusions: Fusion[] = [...colony.fusions]

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
    layout: 'colony',
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
