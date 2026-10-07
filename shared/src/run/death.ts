import { card, DEATH_NAME_LIMIT, DEATH_NAME_PATTERN, deathCardId, isDeathCard, parseDeathCard } from '../cards.ts'
import { MAX_SIGILS } from '../engine/types.ts'
import { Rng } from '../rng.ts'
import { DEATH_SKIP_BONUS } from '../scoring.ts'
import type { RunCard, RunState } from './types.ts'

/** One card from each of a lost run's three hands: whose cost, whose stats and art, and whose sigils. */
export type DeathChoice = { cost: number; stats: number; sigils: number; name: string }

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

/** The three hands a lost run deals, one per part, each up to three cards drawn from the deck. */
export function deathHands(state: RunState): [RunCard[], RunCard[], RunCard[]] {
  // Its own stream off the run's, so the hands are the same wherever the run is replayed.
  const rng = new Rng((state.rng ^ HANDS_SALT) >>> 0)
  const parts = deathParts(state.deck)
  const deal = () => rng.shuffle(parts).slice(0, HAND_SIZE)
  return [deal(), deal(), deal()]
}

const HAND_SIZE = 3
const HANDS_SALT = 0x6d0c_a4d5

export function buildDeathCard(
  state: RunState,
  choice: DeathChoice,
): { ok: true; id: string } | { ok: false; reason: string } {
  const [costs, stats, sigils] = deathHands(state)
  const costCard = costs.find((entry) => entry.id === choice.cost)
  const statsCard = stats.find((entry) => entry.id === choice.stats)
  const sigilCard = sigils.find((entry) => entry.id === choice.sigils)
  if (!costCard || !statsCard || !sigilCard) return { ok: false, reason: 'Choose one card from each hand' }
  const problem = deathNameProblem(choice.name)
  if (problem) return { ok: false, reason: problem }
  const id = deathCardId({
    name: tidyDeathName(choice.name),
    cost: deathCost(costCard, statsCard),
    attack: Math.min(statsCard.attack, MOST),
    health: Math.min(statsCard.health, MOST),
    art: statsCard.card,
    // Every sigil the third card carries, as Inscryption's Act I has it.
    sigils: [...new Set(sigilCard.sigils)].slice(0, MAX_SIGILS),
  })
  return parseDeathCard(id) ? { ok: true, id } : { ok: false, reason: 'That card cannot be built' }
}

/** How dangerous a card is to face: its attack, health and sigils, whatever it costs, since P03 never pays. */
export function deathThreat(id: string): number {
  const def = parseDeathCard(id)
  if (!def) return 0
  return def.attack * 2 + def.health + def.sigils.length * 2
}

/** A card this harmless earns nothing for leaving out; one this dangerous (a 7/7) earns the full bonus. */
const HARMLESS = 6
const DANGEROUS = 20

/** What leaving the death card out multiplies a run's score by: the more dangerous the card the last boss brings back, the more. */
export function deathSkipBonus(id: string): number {
  const share = Math.min(1, Math.max(0, (deathThreat(id) - HARMLESS) / (DANGEROUS - HARMLESS)))
  return Math.round((1 + (DEATH_SKIP_BONUS - 1) * share) * 100) / 100
}

/** The most dangerous another player's death card can be and still be dealt into someone else's run. */
export const RIVAL_THREAT_CAP = 16

export const rivalAllowed = (id: string): boolean => parseDeathCard(id) !== null && deathThreat(id) <= RIVAL_THREAT_CAP
