import type { ThreeEvent } from '@react-three/fiber'

/** What can be read on the table: a card by its id, or one of the two wall screens. */
export type Screen = 'log' | 'status'
export type Target = { card: number } | { screen: Screen }

// How long a finger rests on something before it is magnified, and until when a click is a hold's release, not a play.
const HOLD_MS = 280
let heldUntil = 0

/** Whether a click now is only a hold's finger lifting. */
export const holding = (): boolean => performance.now() < heldUntil

/** Called when a hold's finger lifts: the click that follows it is swallowed. */
export function released(): void {
  heldUntil = performance.now() + 400
}

/** Starts timing a finger's press; the hold is told where once it has lasted. Returns what cancels it. */
export function startHold(event: ThreeEvent<PointerEvent>, onHold: (x: number, y: number) => void): () => void {
  const { clientX, clientY } = event.nativeEvent
  const timer = setTimeout(() => {
    heldUntil = Infinity
    onHold(clientX, clientY)
  }, HOLD_MS)
  return () => clearTimeout(timer)
}
