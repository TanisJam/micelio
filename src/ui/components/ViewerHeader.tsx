import { useState } from 'react'
import { formatAge, formatNumber } from '../../domain/format'
import type { RepoSnapshot, RepoSnapshotSource } from '../../domain/repo'
import { ui } from '../theme/tokens'

export interface ViewerHeaderProps {
  snapshot: RepoSnapshot
  onCopyLink: () => void
  onSaveImage: () => void
}

/** The header bar's fixed height, in px -- other fixed-position UI (Legend, the Explore-list toggle, the desktop detail panel) is offset below this so nothing overlaps it. */
export const VIEWER_HEADER_HEIGHT = 56

function SourceBadge({ source }: { source: RepoSnapshotSource }) {
  const isLive = source === 'github'
  return (
    <span
      title={isLive ? 'Fetched live from the GitHub API' : 'Served from a bundled offline sample (no GITHUB_TOKEN configured)'}
      style={{
        flexShrink: 0,
        fontSize: '0.68rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: `2px ${ui.space(2)}`,
        borderRadius: ui.space(3),
        border: `1px solid ${ui.panelBorder}`,
        color: isLive ? '#8fe08a' : ui.textMuted,
      }}
    >
      {isLive ? 'Live' : 'Sample'}
    </span>
  )
}

function HeaderButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: ui.fontBody,
        fontSize: '0.78rem',
        padding: `${ui.space(1)} ${ui.space(3)}`,
        borderRadius: ui.space(2),
        border: `1px solid ${ui.panelBorder}`,
        background: 'transparent',
        color: ui.text,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

/**
 * The viewer's top header: a single compact bar with the repo identity
 * (linked to GitHub, with its description as a hover title so the bar stays
 * one line), stats, a live/sample data-source badge, and the share actions
 * (P10). A fixed, known height (`VIEWER_HEADER_HEIGHT`) so the rest of the
 * fixed-position UI can reserve space below it without overlapping.
 * Deliberately independent of the 3D scene/visual metaphor -- it only reads
 * `RepoSnapshot`, so it doesn't need to change when the scene does.
 */
export function ViewerHeader({ snapshot, onCopyLink, onSaveImage }: ViewerHeaderProps) {
  const { meta } = snapshot
  // Captured once at mount (a lazy `useState` initializer, not a plain
  // render-time call) so the header doesn't re-derive "now" -- and doesn't
  // trip the impure-render-function lint -- on every re-render.
  const [now] = useState(() => Date.now())
  const createdAtMs = Date.parse(meta.createdAt)
  const age = Number.isNaN(createdAtMs) ? null : formatAge(createdAtMs, now)

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: VIEWER_HEADER_HEIGHT,
        zIndex: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ui.space(3),
        padding: `0 ${ui.space(4)}`,
        fontFamily: ui.fontBody,
        color: ui.text,
        background: ui.panelBg,
        borderBottom: `1px solid ${ui.panelBorder}`,
        backdropFilter: 'blur(6px)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: ui.space(3), minWidth: 0 }}>
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          title={meta.description ?? undefined}
          style={{
            minWidth: 0,
            fontFamily: ui.fontDisplay,
            fontSize: '1rem',
            fontWeight: 600,
            color: ui.text,
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta.owner}/{meta.name}
        </a>
        <SourceBadge source={snapshot.source} />
        <div
          className="viewer-header-stats"
          style={{
            gap: ui.space(3),
            fontSize: '0.78rem',
            color: ui.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          <span>★ {formatNumber(meta.stars)}</span>
          <span>⑂ {formatNumber(meta.forks)}</span>
          {age && <span>{age}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: ui.space(2), flexShrink: 0 }}>
        <HeaderButton label="Copy link" onClick={onCopyLink} />
        <HeaderButton label="Save image" onClick={onSaveImage} />
      </div>
    </header>
  )
}
