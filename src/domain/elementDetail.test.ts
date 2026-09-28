import { describe, expect, it } from 'vitest'
import { resolveElementDetail, summarizeElementDetail } from './elementDetail'
import { buildTree } from './tree/buildTree'
import { makeSnapshot } from './tree/testHelpers'

const snapshot = makeSnapshot()
const model = buildTree(snapshot)

describe('resolveElementDetail', () => {
  it('resolves the trunk to a repo overview', () => {
    const detail = resolveElementDetail(model, snapshot, 'trunk')
    expect(detail).toEqual({
      kind: 'repo',
      id: 'trunk',
      owner: snapshot.meta.owner,
      name: snapshot.meta.name,
      description: snapshot.meta.description,
      url: snapshot.meta.url,
      stars: snapshot.meta.stars,
      forks: snapshot.meta.forks,
      createdAt: Date.parse(snapshot.meta.createdAt),
      defaultBranch: snapshot.meta.defaultBranch,
    })
  })

  it('returns null for an unknown id', () => {
    expect(resolveElementDetail(model, snapshot, 'not-a-real-id')).toBeNull()
  })

  it('resolves a limb to an era detail with a real date range and PR/commit counts', () => {
    const limb = model.limbs[0]!
    const detail = resolveElementDetail(model, snapshot, limb.id)
    expect(detail?.kind).toBe('era')
    if (detail?.kind !== 'era') throw new Error('expected era detail')
    expect(detail.startTime).toBe(limb.time)
    expect(detail.endTime).toBeGreaterThanOrEqual(limb.time)
    expect(detail.mergedPrCount).toBe(limb.activity)
    expect(detail.overflowPrCount).toBe(limb.overflowPrCount)
    expect(detail.commitCount).toBeGreaterThanOrEqual(0)
  })

  it('resolves a twig to the real merged PR it represents', () => {
    const twig = model.twigs[0]!
    const pr = snapshot.mergedPullRequests.find((p) => String(p.number) === twig.ref.id)!
    const detail = resolveElementDetail(model, snapshot, twig.id)
    expect(detail?.kind).toBe('pull_request')
    if (detail?.kind !== 'pull_request') throw new Error('expected pull_request detail')
    expect(detail.status).toBe('merged')
    expect(detail.number).toBe(pr.number)
    expect(detail.title).toBe(pr.title)
    expect(detail.url).toBe(pr.url)
    expect(detail.additions).toBe(pr.additions)
    expect(detail.commits.length).toBe(pr.commits.length)
  })

  it('resolves a twig and its fruit to the same PR', () => {
    const twig = model.twigs[0]!
    const fruit = model.fruits.find((f) => f.ref.id === twig.ref.id)!
    const twigDetail = resolveElementDetail(model, snapshot, twig.id)
    const fruitDetail = resolveElementDetail(model, snapshot, fruit.id)
    expect(fruitDetail).toEqual(expect.objectContaining({ kind: 'pull_request', number: (twigDetail as { number: number }).number }))
  })

  it('marks a PR commit that is rendered as a leaf with its clickable element id', () => {
    const twig = model.twigs[0]!
    const detail = resolveElementDetail(model, snapshot, twig.id)
    if (detail?.kind !== 'pull_request') throw new Error('expected pull_request detail')
    const firstCommitEntry = detail.commits[0]!
    // The first commit of a PR is always kept as a leaf (see buildTwig).
    expect(firstCommitEntry.elementId).toBe(`leaf-pr${detail.number}-${firstCommitEntry.oid}`)
  })

  it('resolves a leaf tied to a real commit', () => {
    const leaf = model.leaves.find((l) => l.ref.type === 'commit')!
    const detail = resolveElementDetail(model, snapshot, leaf.id)
    expect(detail?.kind).toBe('commit')
    if (detail?.kind !== 'commit') throw new Error('expected commit detail')
    expect(detail.oid).toBe(leaf.ref.id)
    expect(detail.parentPr).not.toBeNull()
  })

  it('resolves a flower to the real release it represents', () => {
    const flower = model.flowers[0]!
    const release = snapshot.releases.find((r) => r.tag === flower.ref.id)!
    const detail = resolveElementDetail(model, snapshot, flower.id)
    expect(detail).toEqual({
      kind: 'release',
      id: flower.id,
      name: release.name,
      tag: release.tag,
      date: Date.parse(release.date),
      url: release.url,
    })
  })

  it('resolves an open-PR bud to an open pull request detail', () => {
    const bud = model.buds.find((b) => b.source === 'open_pull_request')
    if (!bud) return // fixture-dependent; skip if none generated
    const detail = resolveElementDetail(model, snapshot, bud.id)
    expect(detail?.kind).toBe('pull_request')
    if (detail?.kind !== 'pull_request') throw new Error('expected pull_request detail')
    expect(detail.status).toBe('open')
  })

  it('resolves a branch bud to a branch detail with a constructed GitHub URL', () => {
    const bud = model.buds.find((b) => b.source === 'live_branch')
    if (!bud) return
    const detail = resolveElementDetail(model, snapshot, bud.id)
    expect(detail?.kind).toBe('branch')
    if (detail?.kind !== 'branch') throw new Error('expected branch detail')
    expect(detail.url).toBe(`${snapshot.meta.url}/tree/${detail.name}`)
  })
})

describe('summarizeElementDetail', () => {
  it('summarizes a merged pull request with its number and title', () => {
    const twig = model.twigs[0]!
    const detail = resolveElementDetail(model, snapshot, twig.id)!
    const summary = summarizeElementDetail(detail)
    expect(summary.kindLabel).toBe('Merged pull request')
    expect(summary.title).toContain(`#${(detail as { number: number }).number}`)
    expect(summary.date).toBe((detail as { date: number }).date)
  })

  it('summarizes the repo overview', () => {
    const detail = resolveElementDetail(model, snapshot, 'trunk')!
    const summary = summarizeElementDetail(detail)
    expect(summary.kindLabel).toBe('Repository')
    expect(summary.title).toBe(`${snapshot.meta.owner}/${snapshot.meta.name}`)
  })
})
