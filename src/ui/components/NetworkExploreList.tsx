import { useMemo, useState, type KeyboardEvent } from 'react'
import { buildNetworkExploreGroups, type NetworkModel } from '../../domain/network'
import { formatDate } from '../../domain/format'
import type { RepoSnapshot } from '../../domain/repo'
import { ui } from '../theme/tokens'

export interface NetworkExploreListProps {
  model: NetworkModel
  snapshot: RepoSnapshot
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
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

const STATUS_LABEL: Record<'merged' | 'closed' | 'open' | 'direct', string> = {
  merged: 'Merged',
  closed: 'Closed',
  open: 'Open',
  direct: 'Direct',
}

/**
 * The network model's non-3D alternative (P11, mirrors the tree's own
 * `ExploreList`): year -> pull requests (incl. closed/open) -> commits,
 * selecting the same elements the 3D scene would. Built from
 * `buildNetworkExploreGroups`, which already resolves real titles/headlines,
 * so this component is purely presentational.
 */
export function NetworkExploreList({ model, snapshot, selectedId, onSelect, onClose }: NetworkExploreListProps) {
  const groups = useMemo(() => buildNetworkExploreGroups(model, snapshot), [model, snapshot])
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const [expandedPrs, setExpandedPrs] = useState<Set<string>>(new Set())

  function toggleYear(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  function togglePr(id: string) {
    setExpandedPrs((prev) => {
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
      aria-label="Explore the mycelium network as a list"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 108,
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
      <nav aria-label="Years, pull requests and commits" style={{ overflowY: 'auto', padding: ui.space(3), fontSize: '0.85rem' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {groups.map((group) => {
            const yearOpen = expandedYears.has(group.year)
            return (
              <li key={group.year} style={{ marginBottom: ui.space(2) }}>
                <button
                  type="button"
                  aria-expanded={yearOpen}
                  onClick={() => toggleYear(group.year)}
                  style={{ ...ROW_BUTTON_STYLE, fontWeight: 600 }}
                  aria-label={`Year ${group.year}, ${group.pullRequests.length} pull requests`}
                >
                  <Disclosure open={yearOpen} />
                  {group.year}
                  <span style={{ color: ui.textMuted, fontWeight: 400 }}>{group.pullRequests.length}</span>
                </button>
                {yearOpen && (
                  <ul style={{ listStyle: 'none', margin: 0, padding: `0 0 0 ${ui.space(5)}` }}>
                    {group.pullRequests.length === 0 && <li style={{ color: ui.textMuted, padding: `${ui.space(1)} 0` }}>No pull requests</li>}
                    {group.pullRequests.map((pr) => {
                      const prOpen = expandedPrs.has(pr.id)
                      return (
                        <li key={pr.id}>
                          <button
                            type="button"
                            aria-expanded={prOpen}
                            aria-current={selectedId === pr.id ? 'true' : undefined}
                            onClick={() => {
                              togglePr(pr.id)
                              onSelect(pr.id)
                            }}
                            style={ROW_BUTTON_STYLE}
                            aria-label={
                              pr.number !== null
                                ? `${STATUS_LABEL[pr.status]} pull request: #${pr.number} ${pr.title}, ${formatDate(pr.date)}`
                                : `${pr.title}, ${formatDate(pr.date)}`
                            }
                          >
                            <Disclosure open={prOpen} />
                            <span style={{ color: ui.textMuted, fontSize: '0.75rem' }}>{STATUS_LABEL[pr.status]}</span>
                            {pr.number !== null ? (
                              <>
                                #{pr.number} {pr.title}
                              </>
                            ) : (
                              pr.title
                            )}
                          </button>
                          {prOpen && (
                            <ul style={{ listStyle: 'none', margin: 0, padding: `0 0 0 ${ui.space(5)}` }}>
                              {pr.commits.length === 0 && <li style={{ color: ui.textMuted, padding: `${ui.space(1)} 0` }}>No commits shown</li>}
                              {pr.commits.map((commit) => (
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
