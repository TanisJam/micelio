import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { resolveElementDetail } from '../domain/elementDetail'
import type { RepoSnapshot } from '../domain/repo'
import type { TreeModel } from '../domain/tree'
import { DetailPanel } from './components/DetailPanel'
import { ExploreList } from './components/ExploreList'
import { Legend } from './components/Legend'
import { TimeScrubber } from './components/TimeScrubber'
import { TooltipLayer } from './components/TooltipLayer'
import { useGrowthClock } from './hooks/useGrowthClock'
import { useMediaQuery } from './hooks/useMediaQuery'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { useRepoTree } from './hooks/useRepoTree'
import { useSelection } from './hooks/useSelection'
import { ui } from './theme/tokens'

// Matches `.detail-panel`'s `@media (max-width: 640px)` breakpoint in
// `index.css` -- the point at which the detail panel becomes a bottom sheet.
const MOBILE_QUERY = '(max-width: 640px)'

const Scene = lazy(() => import('./scene/Scene.tsx'))

// The MVP renders a single fixed demo repository (also the offline fixture);
// `/owner/repo` routing is T7 scope.
const DEMO_OWNER = 'pmndrs'
const DEMO_REPO = 'valtio'

/**
 * `?t=0..1` pins the growth cursor to a fixed fraction of the timeline
 * (skipping auto-play) instead of animating, for deterministic visual QA
 * (see `scripts/shot.ts`).
 */
function readDebugProgressOverride(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('t')
  if (raw === null) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null
}

export function App() {
  const { status, model, snapshot, error } = useRepoTree(DEMO_OWNER, DEMO_REPO)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div style={{ position: 'fixed', inset: 0, background: ui.bg, color: ui.text, fontFamily: ui.fontBody }}>
      {status === 'error' && (
        <StatusMessage>
          Could not load {DEMO_OWNER}/{DEMO_REPO}: {error}
        </StatusMessage>
      )}
      {status === 'loading' && <StatusMessage>Growing the tree…</StatusMessage>}
      {status === 'ready' && model && snapshot && (
        <GrownDiorama model={model} snapshot={snapshot} reducedMotion={reducedMotion} />
      )}
    </div>
  )
}

function GrownDiorama({ model, snapshot, reducedMotion }: { model: TreeModel; snapshot: RepoSnapshot; reducedMotion: boolean }) {
  const debugProgress = readDebugProgressOverride()
  const clock = useGrowthClock(model.bounds, reducedMotion, debugProgress)
  const getCurrentTime = useCallback(() => clock.getTime(), [clock])
  const selection = useSelection()
  const [exploreOpen, setExploreOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const [lastSelectedId, setLastSelectedId] = useState(selection.selectedId)

  // The detail panel and the Explore list both anchor to the same side of
  // the screen (and the mobile bottom sheet), so while the list is open its
  // row selections still update `selectedId` (the 3D camera still focuses,
  // and the selection is still shareable via the URL) but the detail panel
  // itself is suppressed, so the two never visually overlap; closing the
  // list reveals the detail panel for whatever ended up selected.
  const selectedDetail =
    !exploreOpen && selection.selectedId ? resolveElementDetail(model, snapshot, selection.selectedId) : null
  // On mobile the detail panel becomes a bottom sheet that covers roughly
  // the lower half of the screen; hide the scrubber while it's open (it'd
  // either be covered or fight the sheet for the same strip) and restore it
  // once the sheet closes (P7/mobile).
  const mobileSheetOpen = isMobile && selectedDetail !== null

  // Collapse back to the compact sheet height whenever the selection changes
  // (including closing), so re-opening a new detail never inherits a stale
  // expanded state from a previous one. Adjusting state during render
  // (rather than in an effect) avoids an extra commit/cascading render --
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  if (selection.selectedId !== lastSelectedId) {
    setLastSelectedId(selection.selectedId)
    setMobileSheetExpanded(false)
  }

  const selectAndCloseExplore = useCallback(
    (id: string | null) => {
      selection.select(id)
      if (id) setExploreOpen(false)
    },
    [selection],
  )
  const openExploreList = useCallback(() => {
    setExploreOpen(true)
    selection.select(null)
  }, [selection])

  return (
    <>
      <Suspense fallback={<StatusMessage>Loading the diorama…</StatusMessage>}>
        <Scene
          model={model}
          getCurrentTime={getCurrentTime}
          reducedMotion={reducedMotion}
          onElementHover={selection.setHovered}
          onElementSelect={selectAndCloseExplore}
          hoveredId={selection.hoveredId}
          selectedId={selection.selectedId}
        />
      </Suspense>
      {!mobileSheetOpen && <TimeScrubber clock={clock} bounds={model.bounds} />}
      <Legend />
      <TooltipLayer model={model} snapshot={snapshot} hoveredId={selection.hoveredId} />
      <DetailPanel
        detail={selectedDetail}
        onClose={() => selection.select(null)}
        onFocusElement={selection.select}
        mobileExpanded={isMobile ? mobileSheetExpanded : undefined}
        onToggleMobileExpand={isMobile ? () => setMobileSheetExpanded((value) => !value) : undefined}
      />
      <button
        type="button"
        onClick={() => (exploreOpen ? setExploreOpen(false) : openExploreList())}
        aria-expanded={exploreOpen}
        style={{
          position: 'fixed',
          top: ui.space(4),
          right: ui.space(4),
          zIndex: 26,
          background: ui.panelBg,
          border: `1px solid ${ui.panelBorder}`,
          borderRadius: ui.space(3),
          color: ui.text,
          fontFamily: ui.fontBody,
          fontSize: '0.85rem',
          padding: `${ui.space(2)} ${ui.space(3)}`,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
        }}
      >
        {exploreOpen ? 'Close explore list' : 'Explore list'}
      </button>
      {exploreOpen && (
        <ExploreList
          model={model}
          snapshot={snapshot}
          selectedId={selection.selectedId}
          onSelect={selection.select}
          onClose={() => setExploreOpen(false)}
        />
      )}
    </>
  )
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: ui.fontDisplay,
        fontSize: '1.1rem',
        color: ui.textMuted,
        textAlign: 'center',
        padding: ui.space(4),
      }}
    >
      {children}
    </div>
  )
}
