import {
  card,
  DEATH_NAME_LIMIT,
  DEATH_NAME_PATTERN,
  deathCardId,
  isDeathCard,
  parseDeathCard,
  type SigilId,
} from '../cards.ts'
import type { RunCard } from './types.ts'

/** What the player picks from a lost run's deck: whose cost, whose stats, and which sigil from which card. */
export type DeathChoice = { cost: number; stats: number; sigil: { card: number; sigil: SigilId } | null; name: string }

/** The highest a stat can be written into the card's id. */
const MOST = 999

/** Cards that can be parts: any but a death card, so a cost can't be shaved a little more each run. */
export const deathParts = (deck: RunCard[]): RunCard[] => deck.filter((entry) => !isDeathCard(entry.card))

/** The cost card sets the cost, at most one lower than the stats card's own, and never free if that one wasn't. */
export const deathCost = (costCard: RunCard, statsCard: RunCard): number => {
  const statsCost = card(statsCard.card).cost
  return Math.max(card(costCard.card).cost, statsCost - 1, Math.min(statsCost, 1))
}

/** Spaces trimmed and runs of them folded into one. */
export const tidyDeathName = (name: string): string => name.trim().replace(/\s+/g, ' ')

export function deathNameProblem(name: string): string | null {
  const tidy = tidyDeathName(name)
  if (!tidy) return 'Give it a name'
  if (tidy.length > DEATH_NAME_LIMIT) return `At most ${DEATH_NAME_LIMIT} characters`
  if (!DEATH_NAME_PATTERN.test(tidy))
    return "Letters, numbers, spaces and . _ ' ! ? - only, starting with a letter or number"
  return null
}

export function buildDeathCard(
  deck: RunCard[],
  choice: DeathChoice,
): { ok: true; id: string } | { ok: false; reason: string } {
  const find = (id: number) => deck.find((entry) => entry.id === id)
  const costCard = find(choice.cost)
  const statsCard = find(choice.stats)
  const sigilCard = choice.sigil ? find(choice.sigil.card) : undefined
  if (!costCard || !statsCard || (choice.sigil && !sigilCard))
    return { ok: false, reason: 'Choose cards from the deck' }
  if ([costCard, statsCard, sigilCard].some((entry) => entry && isDeathCard(entry.card)))
    return { ok: false, reason: 'A death card cannot be part of another' }
  if (choice.sigil && !sigilCard?.sigils.includes(choice.sigil.sigil))
    return { ok: false, reason: 'That card does not have that sigil' }
  const problem = deathNameProblem(choice.name)
  if (problem) return { ok: false, reason: problem }
  const id = deathCardId({
    name: tidyDeathName(choice.name),
    cost: deathCost(costCard, statsCard),
    attack: Math.min(statsCard.attack, MOST),
    health: Math.min(statsCard.health, MOST),
    art: statsCard.card,
    sigils: choice.sigil ? [choice.sigil.sigil] : [],
  })
  return parseDeathCard(id) ? { ok: true, id } : { ok: false, reason: 'That card cannot be built' }
}
