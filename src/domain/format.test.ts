import { describe, expect, it } from 'vitest'
import { formatCount, formatDate, formatDateTime, formatDeletions, formatNumber, formatShortOid, formatSignedNumber } from './format'

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

describe('formatDeletions', () => {
  it('always prefixes with a minus sign, including zero', () => {
    expect(formatDeletions(0)).toBe('−0')
    expect(formatDeletions(44)).toBe('−44')
  })

  it('adds thousands separators', () => {
    expect(formatDeletions(1234)).toBe('−1,234')
  })

  it('falls back to −0 for a non-finite input', () => {
    expect(formatDeletions(Number.NaN)).toBe('−0')
  })
})

describe('formatCount', () => {
  it('uses the singular form for a count of exactly 1', () => {
    expect(formatCount(1, 'file')).toBe('1 file')
  })

  it('uses the plural form for 0 and for counts above 1', () => {
    expect(formatCount(0, 'file')).toBe('0 files')
    expect(formatCount(2, 'file')).toBe('2 files')
    expect(formatCount(1234, 'file')).toBe('1,234 files')
  })

  it('accepts an explicit irregular plural', () => {
    expect(formatCount(1, 'branch', 'branches')).toBe('1 branch')
    expect(formatCount(3, 'branch', 'branches')).toBe('3 branches')
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
