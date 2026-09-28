import { useState } from 'react'
import { palette, ui } from '../theme/tokens'

interface LegendEntry {
  label: string
  color: string
  description: string
}

const ENTRIES: LegendEntry[] = [
  { label: 'Leaf', color: palette.leafFresh, description: 'a commit (color = age, fresh green to autumn rust)' },
  { label: 'Fruit', color: palette.fruit, description: 'a merged pull request' },
  { label: 'Flower', color: palette.blossom, description: 'a release' },
  { label: 'Bud', color: palette.bud, description: 'an open pull request or live branch' },
  { label: 'Limb', color: palette.barkLight, description: 'an era of the repository’s history' },
  { label: 'Soil', color: palette.soilRock, description: 'the languages used in the repository' },
]

/** Compact, collapsible legend explaining the tree's data mapping (P9). */
export function Legend() {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        // Below the fixed `ViewerHeader` bar (`VIEWER_HEADER_HEIGHT` = 56px) plus a small gap.
        top: 64,
        left: ui.space(4),
        zIndex: 25,
        background: ui.panelBg,
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: ui.space(3),
        color: ui.text,
        fontFamily: ui.fontBody,
        backdropFilter: 'blur(6px)',
        maxWidth: 'min(280px, calc(100vw - 32px))',
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
    </div>
  )
}
