import { useCallback, useEffect, useState } from 'react'

const SELECTION_PARAM = 'sel'

function readSelectionFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(SELECTION_PARAM)
}

function writeSelectionToUrl(id: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set(SELECTION_PARAM, id)
  } else {
    url.searchParams.delete(SELECTION_PARAM)
  }
  // `replaceState`, not `pushState`: hovering/clicking around the tree
  // shouldn't spam the browser's back-button history -- only the current
  // selection needs to be in the URL so it's shareable (P10 prep).
  window.history.replaceState(window.history.state, '', url)
}

export interface Selection {
  hoveredId: string | null
  selectedId: string | null
  setHovered: (id: string | null) => void
  select: (id: string | null) => void
}

/**
 * Tracks the hovered element (ephemeral) and the selected element
 * (persisted to `?sel=<id>` so a selection is shareable). Also closes the
 * selection on Escape (P7).
 */
export function useSelection(): Selection {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(readSelectionFromUrl)

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    writeSelectionToUrl(id)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [select])

  return { hoveredId, selectedId, setHovered: setHoveredId, select }
}
