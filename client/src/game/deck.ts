import { CARDS, DEBUG_CARD, OUT_OF_MEMORY } from 'shared'
import { WORST_CARD, withWorstCard } from './fixtures.ts'

const worst = withWorstCard()
export const DECK = Object.values(CARDS).filter(
  (def) => def.id !== DEBUG_CARD && def.id !== OUT_OF_MEMORY && (worst || def.id !== WORST_CARD),
)
