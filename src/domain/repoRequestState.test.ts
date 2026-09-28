import { describe, expect, it } from 'vitest'
import { mapErrorToViewState } from './repoRequestState'

describe('mapErrorToViewState', () => {
  it('maps every known RepoErrorCode (plus network_error) to its own state', () => {
    expect(mapErrorToViewState({ code: 'invalid_input' })).toBe('invalid_input')
    expect(mapErrorToViewState({ code: 'not_found' })).toBe('not_found')
    expect(mapErrorToViewState({ code: 'private_or_forbidden' })).toBe('private_or_forbidden')
    expect(mapErrorToViewState({ code: 'rate_limited' })).toBe('rate_limited')
    expect(mapErrorToViewState({ code: 'token_required' })).toBe('token_required')
    expect(mapErrorToViewState({ code: 'network_error' })).toBe('network_error')
  })

  it('falls back to upstream_error for an unmapped/unexpected code', () => {
    expect(mapErrorToViewState({ code: 'upstream_error' })).toBe('upstream_error')
    // @ts-expect-error -- deliberately an unknown code, to prove the fallback is exhaustive at runtime
    expect(mapErrorToViewState({ code: 'internal_error' })).toBe('upstream_error')
  })
})
