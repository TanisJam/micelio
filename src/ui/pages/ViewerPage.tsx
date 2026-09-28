import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { formatOverflowNote, resolveNetworkElementDetail, type NetworkModel } from '../../domain/network'
import { mapErrorToViewState } from '../../domain/repoRequestState'
import type { RepoSnapshot } from '../../domain/repo'
import { validateRepoIdentity } from '../../domain/validateRepoIdentity'
import { DetailPanel } from '../components/DetailPanel'
import { Legend } from '../components/Legend'
import { NetworkExploreList } from '../components/NetworkExploreList'
import { StateScreen } from '../components/StateScreen'
import { TimeScrubber } from '../components/TimeScrubber'
import { Toast } from '../components/Toast'
import { TooltipLayer } from '../components/TooltipLayer'
import { ViewerHeader } from '../components/ViewerHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useGrowthClock } from '../hooks/useGrowthClock'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useRepoNetwork } from '../hooks/useRepoNetwork'
import { useSelection } from '../hooks/useSelection'
import { useToast } from '../hooks/useToast'
import { ui } from '../theme/tokens'

const MOBILE_QUERY = '(max-width: 640px)'

const Scene = lazy(() => import('../scene/network/Scene.tsx'))

/**
 * `?t=0..1` pins the growth cursor to a fixed fraction of the timeline
 * (skipping autoplay) instead of animating, for deterministic visual QA
 * (see `scripts/shot.ts`).
 */
function readDebugProgressOverride(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('t')
  if (raw === null) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null
}

export interface ViewerPageProps {
  owner: string
  repo: string
}

/**
 * The `/:owner/:repo` route: validates the identity, fetches+renders that
 * repository as a mycelium network (M3), and covers every product state
 * (P6) -- loading, not found, private/forbidden, rate-limited, token-
 * required, network error, and a malformed `owner`/`repo` in the URL itself.
 */
export function ViewerPage({ owner, repo }: ViewerPageProps) {
  const identity = (() => {
    try {
      return validateRepoIdentity(owner, repo)
    } catch {
      return null
    }
  })()

  useDocumentTitle(identity ? `${identity.owner}/${identity.repo} — Huerto` : 'Invalid repository — Huerto')

  if (!identity) {
    return (
      <StateScreen eyebrow="Invalid repository" title="That doesn't look like a GitHub repository">
        &quot;{owner}/{repo}&quot; isn&apos;t a valid GitHub owner/repo pair. Check the spelling, or go back and try
        again.
      </StateScreen>
    )
  }

  return <ViewerPageBody owner={identity.owner} repo={identity.repo} />
}

function ViewerPageBody({ owner, repo }: { owner: string; repo: string }) {
  const { status, model, snapshot, errorInfo } = useRepoNetwork(owner, repo)
  const reducedMotion = usePrefersReducedMotion()
  const [, navigate] = useLocation()

  if (status === 'loading') {
    return (
      <StateScreen title="Germinating…">
        Reading {owner}/{repo}&apos;s releases, pull requests and commits from GitHub.
      </StateScreen>
    )
  }

  if (status === 'error' && errorInfo) {
    return <ErrorState owner={owner} repo={repo} errorInfo={errorInfo} onRetry={() => navigate(0 as unknown as string)} />
  }

  if (!model || !snapshot) return null

  return <ReadyViewer model={model} snapshot={snapshot} reducedMotion={reducedMotion} />
}

function ErrorState({
  owner,
  repo,
  errorInfo,
  onRetry,
}: {
  owner: string
  repo: string
  errorInfo: NonNullable<ReturnType<typeof useRepoNetwork>['errorInfo']>
  onRetry: () => void
}) {
  const state = mapErrorToViewState(errorInfo)
  // Lazy initializer, not a plain render-time call -- see the matching
  // comment in `ViewerHeader`.
  const [now] = useState(() => Date.now())
  const retryAt = errorInfo.retryAfterSeconds !== undefined ? now + errorInfo.retryAfterSeconds * 1000 : undefined
  const [, navigate] = useLocation()
  const home = { label: 'Back to Huerto', onClick: () => navigate('/') }
  const retry = { label: 'Retry', onClick: onRetry }

  switch (state) {
    case 'not_found':
      return (
        <StateScreen eyebrow="404" title="Repository not found" action={home}>
          {owner}/{repo} doesn&apos;t exist, or it was renamed/deleted.
        </StateScreen>
      )
    case 'private_or_forbidden':
      return (
        <StateScreen eyebrow="403" title="This repository is private" action={home}>
          Huerto only reads public repositories in this deployment.
        </StateScreen>
      )
    case 'rate_limited':
      return (
        <StateScreen eyebrow="429" title="GitHub API rate limit reached" action={retry} secondaryAction={home} retryAt={retryAt}>
          Try again once the limit resets, or self-host with a <code>GITHUB_TOKEN</code> to raise it.
        </StateScreen>
      )
    case 'token_required':
      return (
        <StateScreen eyebrow="Sample data only" title="No GitHub token configured" action={home}>
          This deployment has no <code>GITHUB_TOKEN</code>, so only the bundled sample repository (pmndrs/valtio)
          works. Self-host Huerto and set <code>GITHUB_TOKEN</code> (see the README) to browse any public repository.
        </StateScreen>
      )
    case 'network_error':
      return (
        <StateScreen eyebrow="Network error" title="Couldn't reach the server" action={retry} secondaryAction={home}>
          Check your connection and try again.
        </StateScreen>
      )
    case 'invalid_input':
      return (
        <StateScreen eyebrow="Invalid input" title="That repository name isn't valid" action={home}>
          {errorInfo.message}
        </StateScreen>
      )
    case 'upstream_error':
    default:
      return (
        <StateScreen eyebrow="Something went wrong" title="Couldn't load this repository" action={retry} secondaryAction={home}>
          {errorInfo.message}
        </StateScreen>
      )
  }
}

function ReadyViewer({ model, snapshot, reducedMotion }: { model: NetworkModel; snapshot: RepoSnapshot; reducedMotion: boolean }) {
  const debugProgress = readDebugProgressOverride()
  const clock = useGrowthClock(model.bounds.time, reducedMotion, debugProgress)
  const getCurrentTime = useCallback(() => clock.getTime(), [clock])
  const selection = useSelection()
  const [exploreOpen, setExploreOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const [lastSelectedId, setLastSelectedId] = useState(selection.selectedId)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const toast = useToast()

  const selectedDetail =
    !exploreOpen && selection.selectedId ? resolveNetworkElementDetail(model, snapshot, selection.selectedId) : null
  const mobileSheetOpen = isMobile && selectedDetail !== null

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

  const handleCopyLink = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.show('Link copied'))
      .catch(() => toast.show('Could not copy the link'))
  }, [toast])

  const handleSaveImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      toast.show('The scene is still loading')
      return
    }
    const link = document.createElement('a')
    link.download = `huerto-${snapshot.meta.owner}-${snapshot.meta.name}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.show('Image saved')
  }, [snapshot, toast])

  return (
    <>
      <ViewerHeader snapshot={snapshot} onCopyLink={handleCopyLink} onSaveImage={handleSaveImage} />
      <Suspense fallback={<StateScreen title="Growing hyphae…" />}>
        <Scene
          model={model}
          getCurrentTime={getCurrentTime}
          reducedMotion={reducedMotion}
          onElementHover={selection.setHovered}
          onElementSelect={selectAndCloseExplore}
          hoveredId={selection.hoveredId}
          selectedId={selection.selectedId}
          onCanvasReady={(canvas) => {
            canvasRef.current = canvas
          }}
        />
      </Suspense>
      {!mobileSheetOpen && <TimeScrubber clock={clock} bounds={model.bounds.time} />}
      <Legend overflowNote={formatOverflowNote(model.overflow.hyphaeOmitted)} />
      <TooltipLayer resolveDetail={(id) => resolveNetworkElementDetail(model, snapshot, id)} hoveredId={selection.hoveredId} />
      <DetailPanel
        detail={selectedDetail}
        onClose={() => selection.select(null)}
        onFocusElement={selection.select}
        mobileExpanded={isMobile ? mobileSheetExpanded : undefined}
        onToggleMobileExpand={isMobile ? () => setMobileSheetExpanded((value) => !value) : undefined}
      />
      <Toast message={toast.message} />
      <button
        type="button"
        onClick={() => (exploreOpen ? setExploreOpen(false) : openExploreList())}
        aria-expanded={exploreOpen}
        style={{
          position: 'fixed',
          // Below the fixed `ViewerHeader` bar (`VIEWER_HEADER_HEIGHT` = 56px) plus a small gap.
          top: 64,
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
        }}
      >
        {exploreOpen ? 'Close explore list' : 'Explore list'}
      </button>
      {exploreOpen && (
        <NetworkExploreList
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
