import { card, isDeathCard, type Unit } from 'shared'

export type Kind = 'common' | 'rare' | 'death'
export const KINDS: Kind[] = ['common', 'rare', 'death']

export const kindOf = (unit: Unit): Kind =>
  isDeathCard(unit.card) ? 'death' : card(unit.card).tier === 'S' ? 'rare' : 'common'
