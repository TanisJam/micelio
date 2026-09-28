import { lazy, Suspense, useCallback, type ReactNode } from 'react'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { useRepoTree } from './hooks/useRepoTree'
import { ui } from './theme/tokens'

const Scene = lazy(() => import('./scene/Scene.tsx'))

// The MVP renders a single fixed demo repository (also the offline fixture);
// `/owner/repo` routing is T7 scope.
const DEMO_OWNER = 'pmndrs'
const DEMO_REPO = 'valtio'

/**
 * Renders the diorama fully grown: growth (a time cursor animating the tree
 * in over its repository's history) is T5 scope. `getCurrentTime` is a
 * stable function so the 3D scene can read it every frame without a React
 * re-render, matching the contract T5's growth clock will use.
 */
export function App() {
  const { status, model, error } = useRepoTree(DEMO_OWNER, DEMO_REPO)
  const reducedMotion = usePrefersReducedMotion()
  const getCurrentTime = useCallback(() => model?.bounds.lastEventTime ?? 0, [model])

  return (
    <div style={{ position: 'fixed', inset: 0, background: ui.bg, color: ui.text, fontFamily: ui.fontBody }}>
      {status === 'error' && (
        <StatusMessage>
          Could not load {DEMO_OWNER}/{DEMO_REPO}: {error}
        </StatusMessage>
      )}
      {status === 'loading' && <StatusMessage>Growing the tree…</StatusMessage>}
      {status === 'ready' && model && (
        <Suspense fallback={<StatusMessage>Loading the diorama…</StatusMessage>}>
          <Scene model={model} getCurrentTime={getCurrentTime} reducedMotion={reducedMotion} />
        </Suspense>
      )}
    </div>
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
