import { card, DEATH_NAME_LIMIT, DEATH_NAME_PATTERN, deathCardId, isDeathCard, parseDeathCard } from '../cards.ts'
import { MAX_SIGILS } from '../engine/types.ts'
import { Rng } from '../rng.ts'
import { DEATH_SKIP_BONUS } from '../scoring.ts'
import type { RunCard, RunState } from './types.ts'

/** One card from each of a lost run's three hands, whose cost, whose stats and art, and whose sigils, and a name. */
export type DeathChoice = { cost: number; stats: number; sigils: number; name: string }

/** The highest a stat can be written into the card's id. */
export const DEATH_STAT_MOST = 999
const MOST = DEATH_STAT_MOST

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

const HAND_SIZE = 3
const COST_SALT = 0x6d0c_a4d5
const STATS_SALT = 0x2b7e_1516
const SIGIL_SALT = 0x5f35_76a1

/** A stream of its own off the run's, so the cards dealt are the same wherever the run is replayed. */
const stream = (state: RunState, salt: number) => new Rng((state.rng ^ salt) >>> 0)

/** The first hand a lost run deals: three cards, one to give the death card its cost. */
export function deathCostHand(state: RunState): RunCard[] {
  return stream(state, COST_SALT).shuffle(deathParts(state.deck)).slice(0, HAND_SIZE)
}

/** The second hand, once the cost is picked: three cards within one cost of it, one to give its stats and art. */
export function deathStatsHand(state: RunState, cost: number): RunCard[] {
  const costCard = deathCostHand(state).find((entry) => entry.id === cost)
  if (!costCard) return []
  const near = deathParts(state.deck).filter((entry) => Math.abs(card(entry.card).cost - card(costCard.card).cost) <= 1)
  return stream(state, STATS_SALT ^ cost)
    .shuffle(near)
    .slice(0, HAND_SIZE)
}

/** The third hand, once the stats are picked: three cards from the deck, one to give every sigil it has. */
export function deathSigilHand(state: RunState, cost: number, stats: number): RunCard[] {
  if (!deathStatsHand(state, cost).some((entry) => entry.id === stats)) return []
  return stream(state, SIGIL_SALT ^ Math.imul(cost, 31) ^ stats)
    .shuffle(deathParts(state.deck))
    .slice(0, HAND_SIZE)
}

export function buildDeathCard(
  state: RunState,
  choice: DeathChoice,
): { ok: true; id: string } | { ok: false; reason: string } {
  const costCard = deathCostHand(state).find((entry) => entry.id === choice.cost)
  const statsCard = deathStatsHand(state, choice.cost).find((entry) => entry.id === choice.stats)
  const sigilCard = deathSigilHand(state, choice.cost, choice.stats).find((entry) => entry.id === choice.sigils)
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
