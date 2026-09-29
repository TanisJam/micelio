import { afterEach, describe, expect, it } from 'vitest'
import { handleHealthRequest } from './handleHealthRequest.ts'

const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN

describe('handleHealthRequest', () => {
  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = ORIGINAL_TOKEN
  })

  it('reports tokenConfigured: true when GITHUB_TOKEN is set', () => {
    process.env.GITHUB_TOKEN = 'ghp_fake_for_test'
    expect(handleHealthRequest()).toEqual({ tokenConfigured: true })
  })

  it('reports tokenConfigured: false when GITHUB_TOKEN is unset', () => {
    delete process.env.GITHUB_TOKEN
    expect(handleHealthRequest()).toEqual({ tokenConfigured: false })
  })

  it('reports tokenConfigured: false when GITHUB_TOKEN is an empty string', () => {
    process.env.GITHUB_TOKEN = ''
    expect(handleHealthRequest()).toEqual({ tokenConfigured: false })
  })

  it('never includes the token value itself in the response', () => {
    process.env.GITHUB_TOKEN = 'super-secret-value'
    const body = handleHealthRequest()
    expect(JSON.stringify(body)).not.toContain('super-secret-value')
  })
})
