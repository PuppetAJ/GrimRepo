import { card } from '../cards.ts'
import { nextBotAction, type Strategy } from '../engine/bot.ts'
import { findNode } from './map.ts'
import { legalRunActions } from './run.ts'
import type { RunAction, RunCard, RunState } from './types.ts'

const value = (entry: { attack: number; health: number }) => entry.attack * 2 + entry.health
const cardValue = (id: string) => value(card(id)) / (card(id).cost + 1)
const best = (deck: RunCard[]) => [...deck].sort((a, b) => value(b) - value(a))[0]

// Nodes the bot heads for first, since they only ever strengthen the deck.
const PREFERRED = ['card', 'campfire', 'event', 'stones', 'battle', 'boss']

/** Deterministic: takes the best-value card, buffs its strongest card once, and plays battles greedily. */
export function nextRunAction(state: RunState, strategy: Strategy = 'greedy'): RunAction {
  const legal = legalRunActions(state)
  const visit = state.visit
  if (!visit) {
    const rank = (action: RunAction) =>
      action.type === 'go' ? PREFERRED.indexOf(findNode(state.map, action.node)?.kind ?? 'boss') : PREFERRED.length
    return [...legal].sort((a, b) => rank(a) - rank(b))[0] as RunAction
  }
  switch (visit.kind) {
    case 'battle':
      return visit.game.status === 'won'
        ? { type: 'leave' }
        : { type: 'play', action: nextBotAction(visit.game, strategy) }
    case 'card':
    case 'reward': {
      const scores = visit.offer.map(cardValue)
      return { type: 'take', index: scores.indexOf(Math.max(...scores)) }
    }
    case 'campfire': {
      const target = best(state.deck)
      return visit.buffs === 0 && target ? { type: 'buff', card: target.id } : { type: 'leave' }
    }
    case 'event':
      return { type: 'choose', option: 0 }
    case 'stones':
      return { type: 'leave' }
  }
}

/** Stops at limit in case the bot ever loops. */
export function playRun(
  state: RunState,
  apply: (s: RunState, a: RunAction) => RunState,
  { limit = 100_000, strategy = 'greedy' }: { limit?: number; strategy?: Strategy } = {},
) {
  const actions: RunAction[] = []
  let current = state
  while (current.status === 'playing' && actions.length < limit) {
    const action = nextRunAction(current, strategy)
    actions.push(action)
    current = apply(current, action)
  }
  return { state: current, actions }
}
