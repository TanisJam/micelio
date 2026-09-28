import { lazy, Suspense, useCallback, type ReactNode } from 'react'
import type { TreeModel } from '../domain/tree'
import { TimeScrubber } from './components/TimeScrubber'
import { useGrowthClock } from './hooks/useGrowthClock'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { useRepoTree } from './hooks/useRepoTree'
import { ui } from './theme/tokens'

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
  const { status, model, error } = useRepoTree(DEMO_OWNER, DEMO_REPO)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div style={{ position: 'fixed', inset: 0, background: ui.bg, color: ui.text, fontFamily: ui.fontBody }}>
      {status === 'error' && (
        <StatusMessage>
          Could not load {DEMO_OWNER}/{DEMO_REPO}: {error}
        </StatusMessage>
      )}
      {status === 'loading' && <StatusMessage>Growing the tree…</StatusMessage>}
      {status === 'ready' && model && <GrownDiorama model={model} reducedMotion={reducedMotion} />}
    </div>
  )
}

function GrownDiorama({ model, reducedMotion }: { model: TreeModel; reducedMotion: boolean }) {
  const debugProgress = readDebugProgressOverride()
  const clock = useGrowthClock(model.bounds, reducedMotion, debugProgress)
  const getCurrentTime = useCallback(() => clock.getTime(), [clock])

  return (
    <>
      <Suspense fallback={<StatusMessage>Loading the diorama…</StatusMessage>}>
        <Scene model={model} getCurrentTime={getCurrentTime} reducedMotion={reducedMotion} />
      </Suspense>
      <TimeScrubber clock={clock} bounds={model.bounds} />
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
