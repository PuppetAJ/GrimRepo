import { CARDS } from 'shared'
import { WORST_CARD, withWorstCard } from './fixtures.ts'

// Y2K stays a secret; dev and test builds add the worst-case card for layout checks.
const worst = withWorstCard()
export const DECK = Object.values(CARDS).filter((def) => def.id !== 'Y2K' && (worst || def.id !== WORST_CARD))
