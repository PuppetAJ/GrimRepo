import type { Unit } from 'shared'
import type { View } from '../../view.ts'
import type { Screen, Target } from '../reading.ts'

// The most of P03's console a log readout holds.
export const LOG_READ = 200

// A touch screen, where cards are read by holding them and a hand card is lifted before it is played.
export const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** How the scene's cards and screens tell the page to read them. */
export type Reader = {
  /** The hand card lifted by a first tap on touch. */
  peek: number | null
  hold: (target: Target, x: number, y: number) => void
  lift: (unit: Unit | null) => void
  /** Pins a screen's readout open, or closes it if it is the one pinned. */
  pin: (screen: Screen) => void
}

/** What a reader shows: a card in full, or a screen's lines. */
export type Readout = { unit: Unit } | { lines: string[] }

/** A card on the table or in the hand, by its id. */
export function unitOf(view: View, uid: number): Unit | null {
  return [...view.hand, ...view.board, ...view.front, ...view.back].find((unit) => unit?.uid === uid) ?? null
}
