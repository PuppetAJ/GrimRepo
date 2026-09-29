import { TIP } from 'shared'
import type { View } from '../../view.ts'

/** The scale drawn in text for the status monitor: six marks a side, filling out from the middle toward the leader. */
function scaleBar(scale: number): string {
  const marks = Math.round((Math.min(TIP, Math.abs(scale)) / TIP) * 6)
  const you = scale > 0 ? marks : 0
  const p03 = scale < 0 ? marks : 0
  return `YOU[${' '.repeat(6 - you)}${'#'.repeat(you)}|${'#'.repeat(p03)}${' '.repeat(6 - p03)}]P03`
}

/** The left monitor: the battle log, the last eight lines of P03's console, or as many as asked for. */
export function logLines(log: string[], count = 8): string[] {
  return ['// P03 CONSOLE', ...log.slice(-count).map((line) => line.replace(/^P03> /, '> '))]
}

/** The right monitor: the scale, the turn and the deck. */
export function statusLines(view: Pick<View, 'scale' | 'turn' | 'deck'>): string[] {
  return [
    '// STATUS',
    `SCALE ${view.scale === 0 ? 'LEVEL' : `${view.scale > 0 ? '+' : ''}${view.scale} ${view.scale > 0 ? 'YOU' : 'P03'}`}`,
    scaleBar(view.scale),
    `TIP AT ${TIP}`,
    `TURN ${view.turn}`,
    `DECK ${view.deck}`,
  ]
}
