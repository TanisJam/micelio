import { useState } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { mycelium, ui } from '../theme/tokens'

/** Same breakpoint as `ViewerHeader`'s own narrow-layout query. */
const NARROW_LEGEND_QUERY = '(max-width: 640px)'

interface LegendEntry {
  label: string
  color: string
  description: string
}

export interface LegendProps {
  /** Pre-formatted (`formatOverflowNote`) honesty note for PR-derived hyphae the render cap omitted -- `null`/omitted when nothing was omitted (P12/M3b item 6: "a small, quiet note near the legend"). */
  overflowNote?: string | null
  /** Unit 1: pre-formatted (`formatFetchTruncationNote`) honesty note for when the cold-fetch time budget (or a mid-pagination failure) stopped a pull-request list short of its full history -- `null`/omitted when nothing was truncated. Rendered as its own quiet note, same style as `overflowNote`, so a viewer can see both an honest fetch note and an honest render-cap note at once when both apply. */
  fetchTruncationNote?: string | null
  /** A subtle one-time pulse (A5/T8 "first-visit legibility") drawing a first-time visitor's eye to the legend while the growth caption is guiding them -- a finite CSS animation (`legend-pulse-once` in `index.css`), never a repeating attention-grab. Caller gates this off under `prefers-reduced-motion`. */
  pulse?: boolean
}

const ENTRIES: LegendEntry[] = [
  { label: 'Spore', color: mycelium.sporeCore, description: 'the first commit / the repository itself' },
  { label: 'Distance from center', color: mycelium.ring, description: 'time (always later further out)' },
  { label: 'Filament', color: mycelium.hyphaActiveTip, description: 'a pull request or a burst of commits pushed directly (length = amount of work)' },
  { label: 'Fork', color: mycelium.hyphaActiveBase, description: 'a branch was created' },
  { label: 'Knot', color: mycelium.fusion, description: 'a merged pull request' },
  { label: 'Dry filament', color: mycelium.hyphaDeadTip, description: 'closed without merging' },
  { label: 'Glowing tip', color: mycelium.hyphaOpen, description: 'an open pull request or live branch' },
  { label: 'Fine hair', color: mycelium.hyphaActiveTip, description: 'a commit' },
  { label: 'Mushroom', color: mycelium.mushroomCap, description: 'a release' },
]

/** Compact, collapsible legend explaining the mycelium's data mapping (P9), plus an optional quiet overflow-honesty note (P12). */
export function Legend({ overflowNote = null, fetchTruncationNote = null, pulse = false }: LegendProps) {
  const [open, setOpen] = useState(false)
  const narrow = useMediaQuery(NARROW_LEGEND_QUERY)
  const notes = [overflowNote, fetchTruncationNote].filter((note): note is string => Boolean(note))

  return (
    <div
      style={{
        position: 'fixed',
        // Below the fixed `ViewerHeader` bar (`VIEWER_HEADER_HEIGHT` = 56px) plus a small gap.
        top: 64,
        left: ui.space(4),
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: ui.space(1),
        // Round-3 orchestrator finding (task D): on a narrow viewport, the
        // fixed "Explore list" button (`ViewerPage.tsx`, `right: ui.space(4)`)
        // shares this exact row -- the old `min(280px, ...)` cap let this
        // panel grow wide enough to encroach into the button's own reserved
        // space and visually overlap it. Reserve real room for the button +
        // a gap only on narrow viewports; desktop (where there was no
        // collision) keeps its original cap unchanged.
        maxWidth: narrow ? 'calc(100vw - 165px)' : 'min(280px, calc(100vw - 32px))',
      }}
    >
      <div
        className={pulse ? 'legend-pulse-once' : undefined}
        style={{
          background: ui.panelBg,
          border: `1px solid ${ui.panelBorder}`,
          borderRadius: ui.space(3),
          color: ui.text,
          fontFamily: ui.fontBody,
          backdropFilter: 'blur(6px)',
          overflow: 'hidden',
        }}
      >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="legend-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: ui.space(2),
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: ui.text,
          cursor: 'pointer',
          padding: `${ui.space(2)} ${ui.space(3)}`,
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        Legend
        <span aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
          ▾
        </span>
      </button>
      {open && (
        <ul
          id="legend-content"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: `0 ${ui.space(3)} ${ui.space(3)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: ui.space(2),
            fontSize: '0.78rem',
          }}
        >
          {ENTRIES.map((entry) => (
            <li key={entry.label} style={{ display: 'flex', alignItems: 'flex-start', gap: ui.space(2) }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: entry.color,
                  marginTop: 2,
                }}
              />
              <span>
                <strong>{entry.label}</strong> = {entry.description}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* Round-3 orchestrator finding (task D): on a narrow viewport these
          honesty notes used to always render as their own separate rows,
          right next to the "Explore list" button -- real overlap risk on a
          390px viewport. Tucked inside the collapsible panel instead
          (collapsed/hidden by default, same as the entries list above),
          never overlapping any fixed button. Desktop is unaffected -- the
          notes stay always-visible there, same as before. */}
      {narrow && open && notes.length > 0 && (
        <div
          style={{
            padding: `0 ${ui.space(3)} ${ui.space(3)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: ui.space(1),
            borderTop: `1px solid ${ui.panelBorder}`,
            marginTop: ui.space(1),
            paddingTop: ui.space(2),
          }}
        >
          {notes.map((note) => (
            <p key={note} style={{ margin: 0, fontFamily: ui.fontBody, fontSize: '0.72rem', color: ui.textMuted }}>
              {note}
            </p>
          ))}
        </div>
      )}
      </div>
      {!narrow &&
        notes.map((note) => (
          <p
            key={note}
            style={{
              margin: 0,
              padding: `${ui.space(1)} ${ui.space(3)}`,
              fontFamily: ui.fontBody,
              fontSize: '0.72rem',
              color: ui.textMuted,
              background: ui.panelBg,
              border: `1px solid ${ui.panelBorder}`,
              borderRadius: ui.space(3),
              backdropFilter: 'blur(6px)',
            }}
          >
            {note}
          </p>
        ))}
    </div>
  )
}
