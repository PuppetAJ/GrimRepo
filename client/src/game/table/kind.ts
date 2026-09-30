import { card, type Unit } from 'shared'

// The rare card is a red disk; every other card shares the common one.
export type Kind = 'common' | 'rare'

export const kindOf = (unit: Unit): Kind => (card(unit.card).tier === 'S' ? 'rare' : 'common')
