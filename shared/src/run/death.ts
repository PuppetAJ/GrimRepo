import { card, DEATH_NAME_LIMIT, DEATH_NAME_PATTERN, deathCardId, isDeathCard, parseDeathCard } from '../cards.ts'
import { MAX_SIGILS } from '../engine/types.ts'
import { Rng } from '../rng.ts'
import { DEATH_SKIP_BONUS } from '../scoring.ts'
import type { RunCard, RunState } from './types.ts'

export type DeathChoice = { cost: number; stats: number; sigils: number; name: string }

export const DEATH_STAT_MOST = 999
const MOST = DEATH_STAT_MOST

export const deathParts = (deck: RunCard[]): RunCard[] => deck.filter((entry) => !isDeathCard(entry.card))

export const deathCost = (costCard: RunCard, statsCard: RunCard): number => {
  const statsCost = card(statsCard.card).cost
  return Math.max(card(costCard.card).cost, statsCost - 1, Math.min(statsCost, 1))
}

export const OLD_DATA_REFUSED = 'That name is reserved. For nothing. Pick another.'

export const isOldData = (name: string): boolean =>
  name
    .toLowerCase()
    .replaceAll('0', 'o')
    .replaceAll('1', 'l')
    .replace(/[^a-z]/g, '') === 'olddata'

export const tidyDeathName = (name: string): string => name.trim().replace(/\s+/g, ' ')

export function deathNameProblem(name: string): string | null {
  const tidy = tidyDeathName(name)
  if (!tidy) return 'Give it a name'
  if (tidy.length > DEATH_NAME_LIMIT) return `At most ${DEATH_NAME_LIMIT} characters`
  if (isOldData(tidy)) return OLD_DATA_REFUSED
  if (!DEATH_NAME_PATTERN.test(tidy))
    return "Letters, numbers, spaces and . _ ' ! ? - only, starting with a letter or number"
  return null
}

const HAND_SIZE = 3
const COST_SALT = 0x6d0c_a4d5
const STATS_SALT = 0x2b7e_1516
const SIGIL_SALT = 0x5f35_76a1
const FAR_SALT = 0x0ad3_93c7

const stream = (state: RunState, salt: number) => new Rng((state.rng ^ salt) >>> 0)

export function deathCostHand(state: RunState): RunCard[] {
  return stream(state, COST_SALT).shuffle(deathParts(state.deck)).slice(0, HAND_SIZE)
}

export function deathStatsHand(state: RunState, cost: number): RunCard[] {
  const costCard = deathCostHand(state).find((entry) => entry.id === cost)
  if (!costCard) return []
  const apart = (entry: RunCard) => Math.abs(card(entry.card).cost - card(costCard.card).cost)
  const parts = deathParts(state.deck)
  const near = stream(state, STATS_SALT ^ cost).shuffle(parts.filter((entry) => apart(entry) <= 1))
  if (near.length >= HAND_SIZE) return near.slice(0, HAND_SIZE)
  const far = stream(state, FAR_SALT ^ cost)
    .shuffle(parts.filter((entry) => apart(entry) > 1))
    .sort((a, b) => apart(a) - apart(b))
  return [...near, ...far].slice(0, HAND_SIZE)
}

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
    sigils: [...new Set(sigilCard.sigils)].slice(0, MAX_SIGILS),
  })
  return parseDeathCard(id) ? { ok: true, id } : { ok: false, reason: 'That card cannot be built' }
}

export function deathThreat(id: string): number {
  const def = parseDeathCard(id)
  if (!def) return 0
  return def.attack * 2 + def.health + def.sigils.length * 2
}

const HARMLESS = 6
const DANGEROUS = 20

export function deathSkipBonus(id: string): number {
  const share = Math.min(1, Math.max(0, (deathThreat(id) - HARMLESS) / (DANGEROUS - HARMLESS)))
  return Math.round((1 + (DEATH_SKIP_BONUS - 1) * share) * 100) / 100
}

export const RIVAL_THREAT_CAP = 16

export const rivalAllowed = (id: string): boolean => parseDeathCard(id) !== null && deathThreat(id) <= RIVAL_THREAT_CAP
