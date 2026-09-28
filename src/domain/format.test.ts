import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatNumber, formatShortOid, formatSignedNumber } from './format'

describe('formatDate', () => {
  it('formats an epoch timestamp as a readable date', () => {
    expect(formatDate(Date.UTC(2023, 0, 5))).toBe('Jan 5, 2023')
  })

  it('falls back for a non-finite input', () => {
    expect(formatDate(Number.NaN)).toBe('Unknown date')
  })
})

describe('formatDateTime', () => {
  it('formats an epoch timestamp with a time component', () => {
    expect(formatDateTime(Date.UTC(2023, 0, 5))).toContain('2023')
  })

  it('falls back for a non-finite input', () => {
    expect(formatDateTime(Number.POSITIVE_INFINITY)).toBe('Unknown date')
  })
})

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('falls back to 0 for a non-finite input', () => {
    expect(formatNumber(Number.NaN)).toBe('0')
  })
})

describe('formatSignedNumber', () => {
  it('prefixes a positive value with +', () => {
    expect(formatSignedNumber(128)).toBe('+128')
  })

  it('prefixes a negative value with -', () => {
    expect(formatSignedNumber(-4)).toBe('-4')
  })

  it('adds no sign for zero', () => {
    expect(formatSignedNumber(0)).toBe('0')
  })
})

describe('formatShortOid', () => {
  it('shortens a commit oid to 7 characters', () => {
    expect(formatShortOid('abcdef1234567890')).toBe('abcdef1')
  })

  it('leaves a short oid unchanged', () => {
    expect(formatShortOid('abc')).toBe('abc')
  })
})
