import { attackIn, type Slot, type Unit } from 'shared'

/** A card as the table shows it, with `aura` the attack the cards around it add (or, below 0, take away). */
export type Shown = Unit & { aura?: number }

type Rows = { board: Slot[]; front: Slot[]; back: Slot[] }

/** The card in a lane, its attack counting Tech Lead beside it and Packet Loss or Pop-up opposite; queued cards don't attack. */
export function shown(rows: Rows, row: keyof Rows, lane: number): Shown | null {
  const unit = rows[row][lane]
  if (!unit || row === 'back') return unit ?? null
  const attack = row === 'board' ? attackIn(rows.board, rows.front, lane) : attackIn(rows.front, rows.board, lane)
  return attack === unit.attack ? unit : { ...unit, attack, aura: attack - unit.attack }
}
