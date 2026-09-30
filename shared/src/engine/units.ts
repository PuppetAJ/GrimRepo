import { card } from '../cards.ts'
import type { DeckCard, GameState, Slot, Unit } from './types.ts'

export const deckCard = (id: string): DeckCard => {
  const def = card(id)
  return { card: id, attack: def.attack, health: def.health, sigils: [...def.sigils] }
}

function unitOf(state: GameState, from: DeckCard): Unit {
  state.nextUid += 1
  return {
    uid: state.nextUid - 1,
    card: from.card,
    attack: from.attack,
    health: from.health,
    maxHealth: from.health,
    sigils: [...from.sigils],
  }
}

export const makeUnit = (state: GameState, id: string): Unit => unitOf(state, deckCard(id))

export const drawUnit = (state: GameState, source: number): Unit => ({
  ...unitOf(state, state.player.library[source] as DeckCard),
  source,
})

export const costOf = (unit: Unit): number => card(unit.card).cost

/** What a sacrificed unit pays toward a summon. */
export const worthOf = (unit: Unit): number => (unit.sigils.includes('technical_debt') ? 3 : Math.max(costOf(unit), 1))

export const units = (row: Slot[]): Unit[] => row.filter((slot): slot is Unit => slot !== null)
