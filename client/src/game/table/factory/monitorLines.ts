import { TIP } from 'shared'
import type { View } from '../../view.ts'

function scaleBar(scale: number): string {
  const marks = Math.round((Math.min(TIP, Math.abs(scale)) / TIP) * 6)
  const you = scale > 0 ? marks : 0
  const p03 = scale < 0 ? marks : 0
  return `YOU[${' '.repeat(6 - you)}${'#'.repeat(you)}|${'#'.repeat(p03)}${' '.repeat(6 - p03)}]P03`
}

export function logLines(log: string[], count = 8): string[] {
  return ['// P03 CONSOLE', ...log.slice(-count).map((line) => line.replace(/^P03> /, '> '))]
}

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
