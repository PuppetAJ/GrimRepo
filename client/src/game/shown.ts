import { attackIn, type Slot, type Unit } from 'shared'

export type Shown = Unit & { aura?: number }

type Rows = { board: Slot[]; front: Slot[]; back: Slot[] }

export function shown(rows: Rows, row: keyof Rows, lane: number): Shown | null {
  const unit = rows[row][lane]
  if (!unit || row === 'back') return unit ?? null
  const attack = row === 'board' ? attackIn(rows.board, rows.front, lane) : attackIn(rows.front, rows.board, lane)
  return attack === unit.attack ? unit : { ...unit, attack, aura: attack - unit.attack }
}
