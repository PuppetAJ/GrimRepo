import { TIP } from 'shared'
import type { View } from '../../view.ts'

function scaleBar(scale: number): string {
  const marks = Math.round((Math.min(TIP, Math.abs(scale)) / TIP) * 6)
  const you = scale > 0 ? marks : 0
  const p03 = scale < 0 ? marks : 0
  return `YOU[${' '.repeat(6 - you)}${'#'.repeat(you)}|${'#'.repeat(p03)}${' '.repeat(6 - p03)}]P03`
}

export const MONITOR_COLUMNS = 38
export const MONITOR_ROWS = 8

export function wrap(line: string, columns: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of line.split(' ')) {
    const next = row ? `${row} ${word}` : word
    if (next.length <= columns || !row) row = next.slice(0, columns)
    else {
      rows.push(row)
      row = `  ${word}`.slice(0, columns)
    }
  }
  rows.push(row)
  return rows
}

export function logLines(log: string[], count = 8, columns?: number): string[] {
  const lines = log.slice(-count).map((line) => line.replace(/^P03> /, '> '))
  const rows = columns ? lines.flatMap((line) => wrap(line, columns)).slice(-count) : lines
  return ['// P03 CONSOLE', ...rows]
}

export function statusLines(view: Pick<View, 'scale' | 'turn' | 'deck'> & Partial<Pick<View, 'integrity'>>): string[] {
  return [
    '// STATUS',
    `SCALE ${view.scale === 0 ? 'LEVEL' : `${view.scale > 0 ? '+' : ''}${view.scale} ${view.scale > 0 ? 'YOU' : 'P03'}`}`,
    scaleBar(view.scale),
    `TIP AT ${TIP}`,
    ...(view.integrity ? [`INTEGRITY ${view.integrity.left}/${view.integrity.max}`] : []),
    `TURN ${view.turn}`,
    `DECK ${view.deck}`,
  ]
}
