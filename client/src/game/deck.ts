import { CARDS, OUT_OF_MEMORY } from 'shared'
import { WORST_CARD, withWorstCard } from './fixtures.ts'

// Y2K stays a secret and Out of Memory is P03's alone; dev and test builds add the worst-case card for layout checks.
const worst = withWorstCard()
export const DECK = Object.values(CARDS).filter(
  (def) => def.id !== 'Y2K' && def.id !== OUT_OF_MEMORY && (worst || def.id !== WORST_CARD),
)
