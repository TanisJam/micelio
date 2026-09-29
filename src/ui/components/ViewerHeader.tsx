import { useState } from 'react'
import { formatAge, formatNumber } from '../../domain/format'
import type { RepoSnapshot, RepoSnapshotSource } from '../../domain/repo'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { ui } from '../theme/tokens'

const NARROW_HEADER_QUERY = '(max-width: 640px)'

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

/**
 * `icon` collapses the button to a small square icon-only affordance (still
 * a real `aria-label`, never a bare glyph with no accessible name) -- narrow
 * viewports (P5/item 5 of the M3b brief) otherwise let two full-text buttons
 * ("Copy link" / "Save image") eat enough width to truncate the repo name,
 * which should win the space instead.
 */
function HeaderButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  const narrow = useMediaQuery(NARROW_HEADER_QUERY)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={narrow ? label : undefined}
      title={narrow ? label : undefined}
      style={{
        fontFamily: ui.fontBody,
        fontSize: '0.78rem',
        padding: narrow ? ui.space(1) : `${ui.space(1)} ${ui.space(3)}`,
        width: narrow ? 30 : undefined,
        height: narrow ? 30 : undefined,
        display: narrow ? 'inline-flex' : undefined,
        alignItems: narrow ? 'center' : undefined,
        justifyContent: narrow ? 'center' : undefined,
        borderRadius: ui.space(2),
        border: `1px solid ${ui.panelBorder}`,
        background: 'transparent',
        color: ui.text,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span aria-hidden={narrow} style={{ fontSize: narrow ? '0.95rem' : undefined }}>
        {narrow ? icon : label}
      </span>
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
  // M3c item 4b: the source badge is informational, not identity -- on a
  // narrow viewport it's dropped so the repo name (which must never
  // truncate below ~20-24 characters) and the two icon share actions keep
  // priority for the header's limited width, instead of a fixed `min-width`
  // on the name colliding with the badge (a real round-2 visual finding:
  // reserving the name's floor unconditionally pushed the badge into the
  // first icon button at 390px).
  const narrow = useMediaQuery(NARROW_HEADER_QUERY)
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
            // M3c item 4b: guarantees roughly 20+ characters of the repo
            // name stay visible before ellipsis ever kicks in (never
            // truncating a short name just because the share buttons/badge
            // happen to be present) -- `<wbr />` after the slash also gives
            // the browser a real wrap point, so a name that DOES need more
            // room wraps onto a second line (owner / repo) rather than only
            // ever being cut off mid-word.
            minWidth: '20ch',
            maxWidth: '38ch',
            fontFamily: ui.fontDisplay,
            fontSize: '1rem',
            fontWeight: 600,
            color: ui.text,
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.15,
          }}
        >
          {meta.owner}/<wbr />
          {meta.name}
        </a>
        {!narrow && <SourceBadge source={snapshot.source} />}
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
        <HeaderButton label="Copy link" icon="🔗" onClick={onCopyLink} />
        <HeaderButton label="Save image" icon="⇩" onClick={onSaveImage} />
      </div>
    </header>
  )
}
