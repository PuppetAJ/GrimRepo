import type { Unit } from 'shared'
import type { View } from '../../view.ts'
import type { Screen, Target } from '../reading.ts'

// Most log lines a readout keeps.
export const LOG_READ = 200

// On touch, cards are read by holding them and a hand card is lifted before it's played.
export const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export type Reader = {
  /** uid of the hand card lifted by a first tap on touch. */
  peek: number | null
  hold: (target: Target, x: number, y: number) => void
  lift: (unit: Unit | null) => void
  /** Toggles a screen's pinned readout. */
  pin: (screen: Screen) => void
}

export type Readout = { unit: Unit } | { lines: string[] }

export function unitOf(view: View, uid: number): Unit | null {
  return [...view.hand, ...view.board, ...view.front, ...view.back].find((unit) => unit?.uid === uid) ?? null
}
