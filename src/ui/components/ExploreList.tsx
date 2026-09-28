import { useMemo, useState, type KeyboardEvent } from 'react'
import { resolveElementDetail, summarizeElementDetail } from '../../domain/elementDetail'
import { formatDate } from '../../domain/format'
import type { RepoSnapshot } from '../../domain/repo'
import type { TreeModel } from '../../domain/tree'
import { ui } from '../theme/tokens'

export interface ExploreListProps {
  model: TreeModel
  snapshot: RepoSnapshot
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

interface CommitRow {
  id: string
  oid: string
  headline: string
}

interface TwigRow {
  id: string
  label: string
  date: number | null
  commits: CommitRow[]
}

interface EraRow {
  id: string
  label: string
  date: number | null
  twigs: TwigRow[]
}

function buildRows(model: TreeModel, snapshot: RepoSnapshot): EraRow[] {
  const leafIds = new Set(model.leaves.map((leaf) => leaf.id))

  return [...model.limbs]
    .sort((a, b) => a.time - b.time)
    .map((limb) => {
      const detail = resolveElementDetail(model, snapshot, limb.id)
      const summary = detail ? summarizeElementDetail(detail) : null

      const twigs = model.twigs
        .filter((twig) => twig.limbId === limb.id)
        .sort((a, b) => a.time - b.time)
        .map((twig) => {
          const twigDetail = resolveElementDetail(model, snapshot, twig.id)
          const twigSummary = twigDetail ? summarizeElementDetail(twigDetail) : null
          const commits: CommitRow[] =
            twigDetail?.kind === 'pull_request'
              ? twigDetail.commits
                  .filter((commit) => commit.elementId && leafIds.has(commit.elementId))
                  .map((commit) => ({ id: commit.elementId!, oid: commit.oid, headline: commit.headline }))
              : []
          return {
            id: twig.id,
            label: twigSummary?.title ?? twig.id,
            date: twigSummary?.date ?? twig.time,
            commits,
          }
        })

      return {
        id: limb.id,
        label: summary?.title ?? `Era ${limb.eraIndex + 1}`,
        date: summary?.date ?? limb.time,
        twigs,
      }
    })
}

const ROW_BUTTON_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: ui.space(2),
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: ui.text,
  textAlign: 'left' as const,
  cursor: 'pointer',
  padding: `${ui.space(1)} 0`,
  fontFamily: ui.fontBody,
}

function Disclosure({ open }: { open: boolean }) {
  return (
    <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms', width: '1em' }}>
      ▸
    </span>
  )
}

/**
 * A fully keyboard-navigable, non-3D alternative to the tree: era → pull
 * requests → commits, selecting the same elements the 3D scene would (P11).
 * Every row is a plain `<button>`, so Tab/Enter/Space/focus rings work with
 * no bespoke ARIA tree-role plumbing.
 */
export function ExploreList({ model, snapshot, selectedId, onSelect, onClose }: ExploreListProps) {
  const rows = useMemo(() => buildRows(model, snapshot), [model, snapshot])
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set())
  const [expandedTwigs, setExpandedTwigs] = useState<Set<string>>(new Set())

  function toggleEra(id: string) {
    setExpandedEras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTwig(id: string) {
    setExpandedTwigs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Explore repository tree as a list"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        // Below the "Explore list" toggle button that opens this panel, so
        // the two don't visually overlap.
        top: 64,
        right: ui.space(4),
        bottom: ui.space(4),
        width: 'min(380px, calc(100vw - 32px))',
        zIndex: 28,
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(3),
        color: ui.text,
        fontFamily: ui.fontBody,
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: ui.space(3), borderBottom: `1px solid ${ui.panelBorder}` }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontFamily: ui.fontDisplay }}>Explore list</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explore list (Esc)"
          style={{
            background: 'transparent',
            border: `1px solid ${ui.panelBorder}`,
            color: ui.text,
            borderRadius: '50%',
            width: 26,
            height: 26,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      <nav aria-label="Eras, pull requests and commits" style={{ overflowY: 'auto', padding: ui.space(3), fontSize: '0.85rem' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((era) => {
            const eraOpen = expandedEras.has(era.id)
            return (
              <li key={era.id} style={{ marginBottom: ui.space(2) }}>
                <button
                  type="button"
                  aria-expanded={eraOpen}
                  aria-current={selectedId === era.id ? 'true' : undefined}
                  onClick={() => {
                    toggleEra(era.id)
                    onSelect(era.id)
                  }}
                  style={{ ...ROW_BUTTON_STYLE, fontWeight: 600 }}
                  aria-label={`Era: ${era.label}, ${era.date !== null ? formatDate(era.date) : 'unknown date'}`}
                >
                  <Disclosure open={eraOpen} />
                  {era.label}
                  <span style={{ color: ui.textMuted, fontWeight: 400 }}>{era.date !== null ? formatDate(era.date) : ''}</span>
                </button>
                {eraOpen && (
                  <ul style={{ listStyle: 'none', margin: 0, padding: `0 0 0 ${ui.space(5)}` }}>
                    {era.twigs.length === 0 && <li style={{ color: ui.textMuted, padding: `${ui.space(1)} 0` }}>No pull requests</li>}
                    {era.twigs.map((twig) => {
                      const twigOpen = expandedTwigs.has(twig.id)
                      return (
                        <li key={twig.id}>
                          <button
                            type="button"
                            aria-expanded={twigOpen}
                            aria-current={selectedId === twig.id ? 'true' : undefined}
                            onClick={() => {
                              toggleTwig(twig.id)
                              onSelect(twig.id)
                            }}
                            style={ROW_BUTTON_STYLE}
                            aria-label={`Pull request: ${twig.label}, ${twig.date !== null ? formatDate(twig.date) : 'unknown date'}`}
                          >
                            <Disclosure open={twigOpen} />
                            {twig.label}
                          </button>
                          {twigOpen && (
                            <ul style={{ listStyle: 'none', margin: 0, padding: `0 0 0 ${ui.space(5)}` }}>
                              {twig.commits.length === 0 && <li style={{ color: ui.textMuted, padding: `${ui.space(1)} 0` }}>No commits shown</li>}
                              {twig.commits.map((commit) => (
                                <li key={commit.id}>
                                  <button
                                    type="button"
                                    aria-current={selectedId === commit.id ? 'true' : undefined}
                                    onClick={() => onSelect(commit.id)}
                                    style={{ ...ROW_BUTTON_STYLE, fontSize: '0.8rem', color: ui.textMuted }}
                                    aria-label={`Commit: ${commit.headline}`}
                                  >
                                    {commit.headline}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
