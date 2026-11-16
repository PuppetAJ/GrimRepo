import type { Unit } from 'shared'
import { shown, type Shown } from '../../shown.ts'
import type { View } from '../../view.ts'
import type { Screen, Target } from '../reading.ts'

export const READOUT_MAX_LINES = 200

export const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export type Reader = {
  peekedUid: number | null
  hold: (target: Target, x: number, y: number, sticky?: boolean) => void
  lift: (unit: Unit | null) => void
  pin: (screen: Screen) => void
}

export type Readout = { unit: Shown } | { lines: string[] }

export function unitOf(view: View, uid: number): Shown | null {
  const hand = view.hand.find((unit) => unit.uid === uid)
  if (hand) return hand
  for (const row of ['board', 'front', 'back'] as const) {
    const lane = view[row].findIndex((unit) => unit?.uid === uid)
    if (lane >= 0) return shown(view, row, lane)
  }
  return null
}
