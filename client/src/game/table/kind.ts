import { card, isDeathCard, type Unit } from 'shared'

// The rare card is a red disk and a death card an ash-gray one; every other card shares the common one.
export type Kind = 'common' | 'rare' | 'death'
export const KINDS: Kind[] = ['common', 'rare', 'death']

export const kindOf = (unit: Unit): Kind =>
  isDeathCard(unit.card) ? 'death' : card(unit.card).tier === 'S' ? 'rare' : 'common'
