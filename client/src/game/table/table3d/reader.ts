import type { Unit } from 'shared'
import { shown, type Shown } from '../../shown.ts'
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

export type Readout = { unit: Shown } | { lines: string[] }

/** A card by uid, with its attack as the table shows it. */
export function unitOf(view: View, uid: number): Shown | null {
  const hand = view.hand.find((unit) => unit.uid === uid)
  if (hand) return hand
  for (const row of ['board', 'front', 'back'] as const) {
    const lane = view[row].findIndex((unit) => unit?.uid === uid)
    if (lane >= 0) return shown(view, row, lane)
  }
  return null
}
