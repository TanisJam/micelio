import { summarizeElementDetail } from '../elementDetail'
import type { RepoSnapshot } from '../repo'
import { resolveNetworkElementDetail } from './elementDetail'
import type { NetworkModel } from './types'

/**
 * Era-free "Explore list" data for the network model: grouped by (UTC)
 * year -> pull requests -> commits, instead of the tree model's
 * era-boundary grouping (mycelium has no eras -- see the pivot notes in
 * `odd/tasks/micelio-mvp.md`). Resolves real titles/headlines via
 * `resolveNetworkElementDetail`/`summarizeElementDetail` (same pattern the
 * tree's `ExploreList.tsx` uses inline), so this is a ready-to-render,
 * always-honest structure -- never a placeholder string. Pure, no React.
 */

export interface NetworkExploreCommitEntry {
  /** The matching `node` element id. */
  id: string
  headline: string
}

export interface NetworkExplorePrEntry {
  /** The matching hypha element id. */
  id: string
  /** `null` for a `direct` (non-PR) burst entry -- it has no PR number. */
  number: number | null
  title: string
  status: 'merged' | 'closed' | 'open' | 'direct'
  date: number
  commits: NetworkExploreCommitEntry[]
}

export interface NetworkExploreYearGroup {
  year: number
  pullRequests: NetworkExplorePrEntry[]
}

export function buildNetworkExploreGroups(model: NetworkModel, snapshot: RepoSnapshot): NetworkExploreYearGroup[] {
  // Unit 2: a `direct` (WORK BURST) hypha is browsable here too, alongside
  // PR hyphae -- otherwise a repo's direct-push history would be invisible
  // to the non-3D "Explore list" path (P11).
  const listableHyphae = model.hyphae.filter(
    (hypha): hypha is typeof hypha & { kind: 'merged' | 'closed' | 'open' | 'direct' } =>
      hypha.kind === 'merged' || hypha.kind === 'closed' || hypha.kind === 'open' || hypha.kind === 'direct',
  )

  const nodesByHypha = new Map<string, typeof model.nodes>()
  for (const node of model.nodes) {
    const list = nodesByHypha.get(node.hyphaId) ?? []
    list.push(node)
    nodesByHypha.set(node.hyphaId, list)
  }

  const groupsByYear = new Map<number, NetworkExplorePrEntry[]>()

  for (const hypha of listableHyphae) {
    const detail = resolveNetworkElementDetail(model, snapshot, hypha.id)
    if (!detail || (detail.kind !== 'pull_request' && detail.kind !== 'direct_burst')) continue
    const summary = summarizeElementDetail(detail)

    const commits: NetworkExploreCommitEntry[] = (nodesByHypha.get(hypha.id) ?? [])
      .filter((node) => node.ref.type === 'commit')
      .sort((a, b) => a.time - b.time)
      .map((node) => {
        const commitEntry = detail.commits.find((c) => c.elementId === node.id)
        return { id: node.id, headline: commitEntry?.headline ?? node.ref.id }
      })

    const entry: NetworkExplorePrEntry =
      detail.kind === 'pull_request'
        ? { id: hypha.id, number: detail.number, title: summary.title, status: detail.status, date: summary.date ?? hypha.splitTime, commits }
        : { id: hypha.id, number: null, title: summary.title, status: 'direct', date: summary.date ?? hypha.splitTime, commits }

    const year = new Date(entry.date).getUTCFullYear()
    const list = groupsByYear.get(year) ?? []
    list.push(entry)
    groupsByYear.set(year, list)
  }

  return [...groupsByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, pullRequests]) => ({
      year,
      pullRequests: pullRequests.sort((a, b) => a.date - b.date),
    }))
}
