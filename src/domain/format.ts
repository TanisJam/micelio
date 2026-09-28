/**
 * Pure formatting helpers shared by every detail view (P8: "dates/numbers
 * formatted"). Fixed locale (`en-US`) so output is deterministic regardless
 * of the runtime's system locale -- important for both the UI and tests.
 */

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const numberFormatter = new Intl.NumberFormat('en-US')

/** Formats an epoch-ms timestamp as e.g. "Jan 5, 2023". */
export function formatDate(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return 'Unknown date'
  return dateFormatter.format(epochMs)
}

/** Formats an epoch-ms timestamp with a time component, e.g. "Jan 5, 2023, 3:04 PM". */
export function formatDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return 'Unknown date'
  return dateTimeFormatter.format(epochMs)
}

/** Formats a plain count, e.g. 1234 -> "1,234". */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormatter.format(value)
}

/** Formats a line-change delta with an explicit sign, e.g. "+128" / "-4". */
export function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${numberFormatter.format(Math.abs(value))}`
}

/** Shortens a git commit oid to its conventional 7-character short form. */
export function formatShortOid(oid: string): string {
  return oid.slice(0, 7)
}
