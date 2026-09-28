import type { RepoSnapshot } from '../repo'
import { computeTimeBounds } from '../tree/timeBounds'
import { addVec3, scaleVec3, vec3Length } from '../tree/vector'
import { DEFAULT_LAYOUT_OPTIONS, layoutNetwork, type LayoutOptions } from './layout'
import { buildMushrooms } from './mushrooms'
import { buildHyphaTopology, DEFAULT_TOPOLOGY_OPTIONS, type TopologyOptions } from './topology'
import type { HyphaKind, NetworkModel, NetworkOverflow, NetworkSummary } from './types'

/**
 * Builds the full deterministic `NetworkModel` (mycelium topology + layout +
 * mushrooms) from a `RepoSnapshot`. Pure -- no React, no three.js. This is
 * the network-metaphor counterpart of `../tree/buildTree`.
 */

export interface NetworkBuildOptions extends TopologyOptions, LayoutOptions {}

export const DEFAULT_NETWORK_BUILD_OPTIONS: NetworkBuildOptions = {
  ...DEFAULT_TOPOLOGY_OPTIONS,
  ...DEFAULT_LAYOUT_OPTIONS,
}

const HYPHA_KINDS: HyphaKind[] = ['main', 'merged', 'closed', 'open', 'liveBranch']

export function buildNetwork(snapshot: RepoSnapshot, options: Partial<NetworkBuildOptions> = {}): NetworkModel {
  const resolved: NetworkBuildOptions = { ...DEFAULT_NETWORK_BUILD_OPTIONS, ...options }
  const seed = `${snapshot.meta.owner}/${snapshot.meta.name}`.toLowerCase()
  const bounds = computeTimeBounds(snapshot)

  const topology = buildHyphaTopology(snapshot, bounds, resolved)
  const layout = layoutNetwork(topology.main, topology.hyphae, bounds, seed, resolved)
  const mainHypha = layout.hyphae.find((hypha) => hypha.id === topology.main.id)
  const mushrooms = buildMushrooms(snapshot.releases, mainHypha?.points ?? [], seed)

  let maxRadius = 0
  for (const hypha of layout.hyphae) {
    for (const point of hypha.points) {
      const radius = vec3Length(point.position)
      if (radius > maxRadius) maxRadius = radius
    }
  }
  for (const mushroom of mushrooms) {
    const radius = vec3Length(mushroom.position)
    if (radius > maxRadius) maxRadius = radius
  }
  for (const hair of layout.hairs) {
    const tip = addVec3(hair.position, scaleVec3(hair.direction, hair.length))
    const radius = vec3Length(tip)
    if (radius > maxRadius) maxRadius = radius
  }

  const hyphaCountByKind = Object.fromEntries(HYPHA_KINDS.map((kind) => [kind, 0])) as Record<HyphaKind, number>
  for (const hypha of layout.hyphae) hyphaCountByKind[hypha.kind] += 1

  const summary: NetworkSummary = {
    hyphaCountByKind,
    nodeCount: layout.nodes.length,
    mushroomCount: mushrooms.length,
    hairCount: layout.hairs.length,
  }

  const overflow: NetworkOverflow = {
    hyphaeOmitted: topology.hyphaeOmitted,
    nodesOmittedByHypha: layout.nodesOmittedByHypha,
  }

  return {
    seed,
    bounds: { time: bounds, radius: maxRadius },
    spore: layout.spore,
    hyphae: layout.hyphae,
    nodes: layout.nodes,
    tips: layout.tips,
    mushrooms,
    hairs: layout.hairs,
    overflow,
    summary,
  }
}
