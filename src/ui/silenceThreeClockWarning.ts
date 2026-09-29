import { getConsoleFunction, setConsoleFunction } from 'three'

/**
 * B5/T8: `@react-three/fiber@9.8.1` (the latest release as of this fix --
 * verified via `pnpm view @react-three/fiber versions`) still directly
 * constructs its own internal `THREE.Clock` (the R3F store's `clock`
 * field, driving `useFrame`'s `state.clock`/`delta`) -- unavoidable from
 * app code, since it happens inside R3F's own `<Canvas>` setup before any
 * of our JSX mounts. `three@0.186.1` (r183+) made `Clock`'s constructor
 * unconditionally call its internal `warn()` on every instantiation ("This
 * module has been deprecated. Please use THREE.Timer instead"), which
 * fires once per `<Scene>` mount purely from R3F's own internals, not from
 * anything this app calls directly (this app never constructs a
 * `THREE.Clock` itself).
 *
 * `THREE.setConsoleFunction` is three.js's OWN officially exported hook for
 * redirecting its internal log/warn/error calls (`three/src/utils.js`) --
 * not a `console.warn` monkeypatch. This filters out ONLY that one exact,
 * known, benign, third-party-internal message; every other three.js log,
 * warning or error still reaches the real console unchanged, so a genuine
 * future three.js warning is never silently swallowed.
 *
 * Remove this once `@react-three/fiber` ships a `Timer`-based store
 * internally (tracked upstream; re-check `pnpm view @react-three/fiber
 * versions` periodically).
 */
export function silenceThreeClockDeprecationWarning(): void {
  // `getConsoleFunction()` returns `null` until something has called
  // `setConsoleFunction` at least once (three.js's own default, unset,
  // state) -- fall back to the plain `console[type]` three.js itself uses
  // in that case, so every other message's real behavior is unchanged.
  const previous = getConsoleFunction() ?? ((type, message, ...params) => console[type](message, ...params))
  setConsoleFunction((type, message, ...params) => {
    if (type === 'warn' && message.includes('Clock: This module has been deprecated')) return
    previous(type, message, ...params)
  })
}
