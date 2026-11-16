import type { ThreeEvent } from '@react-three/fiber'

export type Screen = 'log' | 'status'
export type Target = { card: number } | { screen: Screen }

const HOLD_MS = 280
let heldUntil = 0

export const holding = (): boolean => performance.now() < heldUntil

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
