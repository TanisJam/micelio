import type { ReactNode } from 'react'
import type { ElementDetail } from '../../domain/elementDetail'
import { formatCount, formatDate, formatDeletions, formatNumber, formatShortOid, formatSignedNumber } from '../../domain/format'
import { ui } from '../theme/tokens'

export interface DetailPanelProps {
  detail: ElementDetail | null
  onClose: () => void
  /** Selects (and camera-focuses) another element from within the panel -- e.g. a PR's commit, or a commit's parent PR. */
  onFocusElement: (id: string) => void
  /** Mobile only: whether the compact bottom sheet is expanded to a taller view (see `.detail-panel` in `index.css`). Omit both this and `onToggleMobileExpand` on desktop, where the panel doesn't need an expand toggle. */
  mobileExpanded?: boolean
  onToggleMobileExpand?: () => void
}

const LINK_STYLE = { color: ui.accent, textDecoration: 'underline', textUnderlineOffset: 2 }

function GitHubLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...LINK_STYLE, fontSize: '0.85rem' }}>
      View on GitHub ↗
    </a>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: ui.space(3) }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: ui.textMuted }}>{label}</div>
      <div style={{ marginTop: ui.space(1) }}>{children}</div>
    </div>
  )
}

function AuthorLine({ author }: { author: { login: string | null; avatarUrl: string | null } }) {
  if (!author.login) return <span style={{ color: ui.textMuted }}>Unknown author</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: ui.space(1) }}>
      {author.avatarUrl && (
        <img
          src={author.avatarUrl}
          alt=""
          width={20}
          height={20}
          style={{ borderRadius: '50%', display: 'block' }}
        />
      )}
      {author.login}
    </span>
  )
}

function DetailBody({ detail, onFocusElement }: { detail: ElementDetail; onFocusElement: (id: string) => void }) {
  switch (detail.kind) {
    case 'repo':
      return (
        <>
          <h2 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.15rem' }}>
            {detail.owner}/{detail.name}
          </h2>
          {detail.description && <p style={{ color: ui.textMuted, fontSize: '0.9rem' }}>{detail.description}</p>}
          <Field label="Stats">
            ★ {formatNumber(detail.stars)} · ⑂ {formatNumber(detail.forks)}
          </Field>
          <Field label="Created">{formatDate(detail.createdAt)}</Field>
          <Field label="Default branch">{detail.defaultBranch}</Field>
          <Field label="Link">
            <GitHubLink href={detail.url} />
          </Field>
        </>
      )

    case 'pull_request': {
      const branchOrigin = detail.origin?.kind === 'branch' ? detail.origin : null
      return (
        <>
          <h2 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.15rem' }}>
            #{detail.number} {detail.title}
          </h2>
          <Field label="Status">
            {detail.status === 'merged' ? 'Merged' : detail.status === 'closed' ? 'Closed without merging' : 'Open'}
          </Field>
          <Field label="Author">
            <AuthorLine author={detail.author} />
          </Field>
          <Field label={detail.status === 'merged' ? 'Merged' : detail.status === 'closed' ? 'Closed' : 'Opened'}>
            {formatDate(detail.date)}
          </Field>
          {detail.origin?.kind === 'colony' && (
            <Field label="Branched from">Sprouted from the colony when the branch was created</Field>
          )}
          {branchOrigin && (
            <Field label="Branched from">
              <button
                type="button"
                onClick={() => onFocusElement(branchOrigin.parentElementId)}
                style={{ background: 'transparent', border: 'none', color: ui.accent, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                #{branchOrigin.parentNumber} {branchOrigin.parentTitle}
              </button>
            </Field>
          )}
          {detail.additions !== null && detail.deletions !== null && (
            <Field label="Changes">
              <span style={{ color: '#7fd88a' }}>{formatSignedNumber(detail.additions)}</span>{' '}
              <span style={{ color: '#e08a8a' }}>{formatDeletions(detail.deletions)}</span>
              {detail.changedFiles !== null && <span style={{ color: ui.textMuted }}> · {formatCount(detail.changedFiles, 'file')}</span>}
            </Field>
          )}
          {detail.labels.length > 0 && (
            <Field label="Labels">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: ui.space(1) }}>
                {detail.labels.map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: '0.72rem',
                      padding: `2px ${ui.space(2)}`,
                      borderRadius: ui.space(3),
                      border: `1px solid ${ui.panelBorder}`,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Field>
          )}
          {detail.commits.length > 0 && (
            <Field label={`Commits (${formatNumber(detail.commitCount ?? detail.commits.length)})`}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: ui.space(1) }}>
                {detail.commits.map((commit) =>
                  commit.elementId ? (
                    <li key={commit.oid}>
                      <button
                        type="button"
                        onClick={() => onFocusElement(commit.elementId!)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: ui.text,
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: `${ui.space(1)} 0`,
                          fontSize: '0.82rem',
                          width: '100%',
                        }}
                      >
                        <code style={{ color: ui.textMuted }}>{formatShortOid(commit.oid)}</code> {commit.headline}
                      </button>
                    </li>
                  ) : (
                    <li key={commit.oid} style={{ fontSize: '0.82rem', color: ui.textMuted, padding: `${ui.space(1)} 0` }}>
                      <code>{formatShortOid(commit.oid)}</code> {commit.headline}
                    </li>
                  ),
                )}
              </ul>
            </Field>
          )}
          <Field label="Link">
            <GitHubLink href={detail.url} />
          </Field>
        </>
      )
    }

    case 'commit':
      return (
        <>
          <h2 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.1rem' }}>{detail.headline}</h2>
          <Field label="Commit">
            <code>{formatShortOid(detail.oid)}</code>
          </Field>
          <Field label="Author">
            <AuthorLine author={detail.author} />
          </Field>
          <Field label="Date">{formatDate(detail.date)}</Field>
          {detail.parentPr && (
            <Field label="Pull request">
              <button
                type="button"
                onClick={() => onFocusElement(detail.parentPr!.elementId)}
                style={{ background: 'transparent', border: 'none', color: ui.accent, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                #{detail.parentPr.number} {detail.parentPr.title}
              </button>
            </Field>
          )}
          <Field label="Link">
            <GitHubLink href={detail.url} />
          </Field>
        </>
      )

    case 'release':
      return (
        <>
          <h2 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.15rem' }}>{detail.name}</h2>
          <Field label="Tag">{detail.tag}</Field>
          <Field label="Released">{formatDate(detail.date)}</Field>
          <Field label="Link">
            <GitHubLink href={detail.url} />
          </Field>
        </>
      )

    case 'branch':
      return (
        <>
          <h2 style={{ margin: 0, fontFamily: ui.fontDisplay, fontSize: '1.15rem' }}>{detail.name}</h2>
          <Field label="Last commit">{formatDate(detail.lastCommitDate)}</Field>
          <Field label="Link">
            <GitHubLink href={detail.url} />
          </Field>
        </>
      )
  }
}

/**
 * The selection detail panel: desktop right side, mobile bottom sheet (via
 * the `.detail-panel` CSS in `index.css`, media-query driven). Renders
 * `null` when nothing is selected.
 */
export function DetailPanel({ detail, onClose, onFocusElement, mobileExpanded, onToggleMobileExpand }: DetailPanelProps) {
  if (!detail) return null

  // Reserve enough right-side padding for both header buttons (close, and
  // the mobile expand toggle when present) so a long title never runs
  // underneath either of them.
  const headerButtonCount = onToggleMobileExpand ? 2 : 1
  const paddingRight = ui.space(6 + headerButtonCount * 4)

  return (
    <div
      className="detail-panel"
      role="dialog"
      aria-label="Selection details"
      data-expanded={mobileExpanded ? 'true' : 'false'}
      style={{
        background: ui.panelBg,
        borderColor: ui.panelBorder,
        borderStyle: 'solid',
        color: ui.text,
        fontFamily: ui.fontBody,
        backdropFilter: 'blur(10px)',
        // Extra right padding reserves space for the absolutely-positioned
        // header buttons so a long title never runs underneath them.
        padding: `${ui.space(4)} ${paddingRight} ${ui.space(4)} ${ui.space(4)}`,
      }}
    >
      {onToggleMobileExpand && (
        <button
          type="button"
          onClick={onToggleMobileExpand}
          aria-label={mobileExpanded ? 'Collapse details' : 'Expand details'}
          style={{
            position: 'absolute',
            top: ui.space(3),
            right: ui.space(9),
            zIndex: 1,
            background: 'transparent',
            border: `1px solid ${ui.panelBorder}`,
            color: ui.text,
            borderRadius: '50%',
            width: 28,
            height: 28,
            cursor: 'pointer',
            fontSize: '0.75rem',
            lineHeight: 1,
          }}
        >
          {mobileExpanded ? '⌄' : '⌃'}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details (Esc)"
        style={{
          position: 'absolute',
          top: ui.space(3),
          right: ui.space(3),
          zIndex: 1,
          background: 'transparent',
          border: `1px solid ${ui.panelBorder}`,
          color: ui.text,
          borderRadius: '50%',
          width: 28,
          height: 28,
          cursor: 'pointer',
          fontSize: '0.9rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <DetailBody detail={detail} onFocusElement={onFocusElement} />
    </div>
  )
}
