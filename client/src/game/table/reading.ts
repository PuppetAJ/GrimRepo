import type { ThreeEvent } from '@react-three/fiber'

export type Screen = 'log' | 'status'
export type Target = { card: number } | { screen: Screen }

// How long a press lasts before it magnifies what's under it.
const HOLD_MS = 280
let heldUntil = 0

/** True when the current click is only a hold being released. */
export const holding = (): boolean => performance.now() < heldUntil

/** Call when a hold lifts so the click that follows is ignored. */
export function released(): void {
  heldUntil = performance.now() + 400
}

export function startHold(event: ThreeEvent<PointerEvent>, onHold: (x: number, y: number) => void): () => void {
  const { clientX, clientY } = event.nativeEvent
  const timer = setTimeout(() => {
    heldUntil = Infinity
    onHold(clientX, clientY)
  }, HOLD_MS)
  return () => clearTimeout(timer)
}
