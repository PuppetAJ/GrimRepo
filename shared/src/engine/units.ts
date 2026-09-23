import { card } from '../cards.ts'
import type { GameState, Slot, Unit } from './types.ts'

export function makeUnit(state: GameState, id: string): Unit {
  const def = card(id)
  const unit = {
    uid: state.nextUid,
    card: id,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    sigils: [...def.sigils],
  }
  state.nextUid += 1
  return unit
}

export const costOf = (unit: Unit): number => card(unit.card).cost

/** Blood a unit pays when sacrificed: its own cost, at least 1, or 3 with Technical Debt. */
export const worthOf = (unit: Unit): number => (unit.sigils.includes('technical_debt') ? 3 : Math.max(costOf(unit), 1))

export const units = (row: Slot[]): Unit[] => row.filter((slot): slot is Unit => slot !== null)
