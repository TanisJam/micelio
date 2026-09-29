import { getConsoleFunction, setConsoleFunction } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { silenceThreeClockDeprecationWarning } from './silenceThreeClockWarning'

describe('silenceThreeClockDeprecationWarning', () => {
  afterEach(() => {
    // Reset three's global console hook so this test file doesn't leak
    // state into any other test that also touches three.js logging.
    setConsoleFunction((type, message, ...params) => console[type](message, ...params))
  })

  it('filters exactly the THREE.Clock deprecation warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    silenceThreeClockDeprecationWarning()

    const consoleFn = getConsoleFunction()
    consoleFn('warn', 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.')

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('lets every other warning through unchanged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    silenceThreeClockDeprecationWarning()

    const consoleFn = getConsoleFunction()
    consoleFn('warn', 'THREE.SomeOtherThing: a real, unrelated warning', 'extra-arg')

    expect(warnSpy).toHaveBeenCalledWith('THREE.SomeOtherThing: a real, unrelated warning', 'extra-arg')
    warnSpy.mockRestore()
  })

  it('lets log/error messages through unchanged', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    silenceThreeClockDeprecationWarning()

    const consoleFn = getConsoleFunction()
    consoleFn('log', 'THREE.Something: informational')
    consoleFn('error', 'THREE.Something: a real error')

    expect(logSpy).toHaveBeenCalledWith('THREE.Something: informational')
    expect(errorSpy).toHaveBeenCalledWith('THREE.Something: a real error')
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('is idempotent -- calling it twice still only filters the one message once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    silenceThreeClockDeprecationWarning()
    silenceThreeClockDeprecationWarning()

    const consoleFn = getConsoleFunction()
    consoleFn('warn', 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.')
    consoleFn('warn', 'THREE.SomeOtherThing: still real')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('THREE.SomeOtherThing: still real')
    warnSpy.mockRestore()
  })
})
