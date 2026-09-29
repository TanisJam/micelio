import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getNetworkElementFocusPosition, type NetworkModel } from '../../../domain/network'
import { easeInOutCubic } from '../../../domain/math'

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

export interface CameraFocusProps {
  model: NetworkModel
  selectedId: string | null
  reducedMotion: boolean
}

const FOCUS_DURATION_SECONDS = 0.9
/**
 * Caps how far the camera TARGET (and, since the offset is preserved, the
 * camera itself) ever pans away from the disc's own center, as a fraction of
 * the model's bounding radius -- a real M3b visual finding: panning the full
 * way to a far-from-center element (e.g. a mushroom near the rim) shifted
 * the whole view enough that the opposite side of the disc ran off-frame
 * (`CameraRig`'s own framing margin only has ~22% of headroom beyond the
 * disc radius, see `FRAME_MARGIN`). Selection still visibly "nudges" the
 * camera toward the element, just never far enough to crop the galaxy.
 */
const MAX_PAN_FRACTION_OF_RADIUS = 0.22

interface FocusAnimation {
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  elapsed: number
}

/**
 * Network counterpart of the tree's `CameraFocus` (identical easing/offset-
 * preserving behavior, see that component's doc) -- eases toward the
 * selected element's focus point, snapping instantly under
 * `prefers-reduced-motion` (P4/P7).
 *
 * **A4/T8 fix**: this effect must depend on `controls`, not just
 * `selectedId`. `CameraRig`'s `<OrbitControls makeDefault>` registers itself
 * into the R3F store asynchronously (its own mount effect calling `set({
 * controls })`), so on the very first render `useThree().controls` is still
 * `null` -- including for a `?sel=` deep link, where `selectedId` is ALREADY
 * non-null on that same first render (`useSelection`'s lazy initial state
 * reads it straight from the URL). With `controls` excluded from the deps
 * array, that first effect run captured `orbitControls = null` in its
 * closure, bailed out via the guard below, and never ran again (since
 * `selectedId` doesn't change again on its own) -- so a deep-linked
 * selection's camera focus silently never happened. Depending on `controls`
 * too makes the effect re-run once `OrbitControls` finishes registering,
 * picking up an already-set `selectedId` at that point.
 */
export function CameraFocus({ model, selectedId, reducedMotion }: CameraFocusProps) {
  const { camera, controls } = useThree()
  const animationRef = useRef<FocusAnimation | null>(null)

  useEffect(() => {
    const orbitControls = controls as OrbitControlsImpl | null
    if (!selectedId || !orbitControls) return
    const focusPosition = getNetworkElementFocusPosition(model, selectedId)
    if (!focusPosition) return

    const toTarget = new THREE.Vector3(focusPosition.x, focusPosition.y, focusPosition.z)
    const maxPan = model.bounds.radius * MAX_PAN_FRACTION_OF_RADIUS
    if (toTarget.length() > maxPan) toTarget.setLength(maxPan)
    const fromTarget = orbitControls.target.clone()
    const offset = camera.position.clone().sub(fromTarget)
    const toPosition = toTarget.clone().add(offset)

    if (reducedMotion) {
      orbitControls.target.copy(toTarget)
      camera.position.copy(toPosition)
      orbitControls.update()
      animationRef.current = null
      return
    }

    animationRef.current = {
      fromTarget,
      toTarget,
      fromPosition: camera.position.clone(),
      toPosition,
      elapsed: 0,
    }
    // `model`/`reducedMotion` are intentionally excluded: `App`'s `key` remounts
    // this whole tree branch on repo change, so they're effectively fixed for
    // this component's lifetime. `controls` is NOT excluded -- see the doc
    // comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, controls])

  useFrame((_state, delta) => {
    const orbitControls = controls as OrbitControlsImpl | null
    const animation = animationRef.current
    if (!animation || !orbitControls) return

    animation.elapsed += delta
    const t = easeInOutCubic(Math.min(1, animation.elapsed / FOCUS_DURATION_SECONDS))
    orbitControls.target.lerpVectors(animation.fromTarget, animation.toTarget, t)
    camera.position.lerpVectors(animation.fromPosition, animation.toPosition, t)
    orbitControls.update()

    if (t >= 1) animationRef.current = null
  })

  return null
}
