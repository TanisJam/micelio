import { useMemo, useSyncExternalStore } from 'react'
import { buildTickerData, currentTickerEvent, tickerCountsAt, type NetworkModel } from '../../domain/network'
import { formatNumber } from '../../domain/format'
import type { RepoSnapshot } from '../../domain/repo'
import type { GrowthClock } from '../hooks/useGrowthClock'
import { ui } from '../theme/tokens'

export interface GrowthTickerProps {
  model: NetworkModel
  snapshot: RepoSnapshot
  clock: GrowthClock
  reducedMotion: boolean
}

/**
 * Unit 4 ("replay history event by event"): a quiet, one-line ticker near
 * the scrubber naming the most recent real event the growth replay has
 * reached ("#65 merged · Add proxyMap · 12 commits", "12 commits pushed to
 * main", "v1.2.0 released"), plus running counters (pull requests ·
 * commits · releases so far) -- both driven by the SAME `clock.getTime()`
 * the 3D scene's own growth reveal reads, via `buildTickerData`/
 * `currentTickerEvent`/`tickerCountsAt` (pure domain, `tickerEvents.ts`).
 *
 * Fades between lines under normal motion; jumps instantly (no transition)
 * under `prefers-reduced-motion`, matching every other animated element in
 * this scene.
 */
export function GrowthTicker({ model, snapshot, clock, reducedMotion }: GrowthTickerProps) {
  const data = useMemo(() => buildTickerData(model, snapshot), [model, snapshot])
  const currentTime = useSyncExternalStore(clock.subscribe, clock.getTime)

  const event = currentTickerEvent(data, currentTime)
  const counts = tickerCountsAt(data, currentTime)

  if (!event) return null

  return (
    <div
      style={{
        // Fixed pixel offset (matching `GrowthCaption`'s own `bottom: 92`
        // sibling placement, not a calc relative to another component's
        // height) -- high enough above the `TimeScrubber` (bottom 16px,
        // ~52px tall) to clear the (dismissible, first-autoplay-only)
        // `GrowthCaption` sitting at `bottom: 92` too.
        position: 'fixed',
        left: '50%',
        bottom: 150,
        zIndex: 21,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: ui.space(1),
        pointerEvents: 'none',
        width: 'min(560px, calc(100vw - 32px))',
      }}
    >
      <div
        key={event.text}
        className={reducedMotion ? undefined : 'ticker-line-fade'}
        style={{
          padding: `${ui.space(1)} ${ui.space(3)}`,
          borderRadius: ui.space(3),
          background: ui.panelBg,
          border: `1px solid ${ui.panelBorder}`,
          color: ui.textMuted,
          fontFamily: ui.fontBody,
          fontSize: '0.76rem',
          backdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {event.text}
      </div>
      <div
        style={{
          fontFamily: ui.fontBody,
          fontSize: '0.68rem',
          color: ui.textMuted,
          opacity: 0.75,
        }}
      >
        {formatNumber(counts.pullRequests)} pull request{counts.pullRequests === 1 ? '' : 's'} · {formatNumber(counts.commits)} commit
        {counts.commits === 1 ? '' : 's'} · {formatNumber(counts.releases)} release{counts.releases === 1 ? '' : 's'}
      </div>
    </div>
  )
}
