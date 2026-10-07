import { card, type SigilId } from '../cards.ts'
import { nextBotAction, type Strategy } from '../engine/bot.ts'
import { findNode } from './map.ts'
import { COMMONS, legalRunActions, PICKS, STARTER_DECKS } from './run.ts'
import { scene, type Effect } from './scenes.ts'
import type { RunAction, RunCard, RunState } from './types.ts'

const value = (entry: { attack: number; health: number }) => entry.attack * 2 + entry.health
const cardValue = (id: string) => value(card(id)) / (card(id).cost + 1)
const best = (deck: RunCard[]) => [...deck].sort((a, b) => value(b) - value(a))[0]

// Sigils with a drawback, which the linter is worth visiting to delete.
const DRAWBACKS: SigilId[] = ['technical_debt', 'deprecated']
const drawback = (deck: RunCard[]) =>
  deck.flatMap((entry) =>
    DRAWBACKS.filter((sigil) => entry.sigils.includes(sigil)).map((sigil) => ({ entry, sigil })),
  )[0]

/** Roughly what an event's effect is worth, against the deck's average card. */
function effectWorth(state: RunState, effect: Effect): number {
  const average =
    state.deck.reduce((sum, entry) => sum + value(entry) / (card(entry.card).cost + 1), 0) /
    Math.max(1, state.deck.length)
  switch (effect.type) {
    case 'addCard':
      return cardValue(effect.card) - average
    case 'removeCard':
      return -1
    case 'boost':
      return (effect.attack * 2 + effect.health) / 1.5
    case 'addSigil':
      return 2
    case 'duplicate':
      return 1
    case 'lint':
      return drawback(state.deck) ? 2 : 0
  }
}

// Nodes the bot heads for first, since they only ever strengthen the deck.
const PREFERRED = ['card', 'shop', 'campfire', 'event', 'stones', 'battle', 'boss']

/** Deterministic: takes the best-value card, buffs its strongest card once, weighs event choices, moves a sigil up, and plays battles greedily. */
export function nextRunAction(state: RunState, strategy: Strategy = 'greedy', deck?: string): RunAction {
  const legal = legalRunActions(state)
  const visit = state.visit
  if (!visit) {
    const rank = (action: RunAction) =>
      action.type === 'go' ? PREFERRED.indexOf(findNode(state.map, action.node)?.kind ?? 'boss') : PREFERRED.length
    return [...legal].sort((a, b) => rank(a) - rank(b))[0] as RunAction
  }
  const average = state.deck.reduce((sum, entry) => sum + cardValue(entry.card), 0) / Math.max(1, state.deck.length)
  switch (visit.kind) {
    case 'start': {
      // Each starter deck in turn by seed, unless one is asked for.
      const ids = Object.keys(STARTER_DECKS)
      return { type: 'start', deck: deck ?? (ids[state.seed % ids.length] as string) }
    }
    case 'blind': {
      // The trait whose cards are worth most on average.
      const worth = visit.picks.map((pick) => {
        const pool = COMMONS.filter(PICKS[pick].fits)
        return pool.reduce((sum, id) => sum + cardValue(id), 0) / Math.max(1, pool.length)
      })
      return { type: 'take', index: worth.indexOf(Math.max(...worth)) }
    }
    case 'shop': {
      // The best card it can afford, if it beats the deck's average.
      const buys = legal.filter((action): action is Extract<RunAction, { type: 'buy' }> => action.type === 'buy')
      const best = [...buys].sort(
        (a, b) => cardValue(visit.offer[b.index]?.card as string) - cardValue(visit.offer[a.index]?.card as string),
      )[0]
      return best && cardValue(visit.offer[best.index]?.card as string) > average ? best : { type: 'leave' }
    }
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
    case 'event': {
      // Picks the choice worth most, the first on a tie.
      const scores = scene(visit.event).options.map((option) =>
        option.effects.reduce((sum, effect) => sum + effectWorth(state, effect), 0),
      )
      return { type: 'choose', option: scores.indexOf(Math.max(...scores)) }
    }
    case 'lint': {
      const found = drawback(state.deck)
      return found ? { type: 'strip', card: found.entry.id, sigil: found.sigil } : { type: 'leave' }
    }
    case 'stones': {
      // Moves a sigil from its weakest card onto its strongest, when that's a step up.
      const worth = (id: number) => value(state.deck.find((entry) => entry.id === id) as RunCard)
      const moves = legal.filter((action) => action.type === 'transfer')
      const bestMove = [...moves].sort((a, b) => worth(b.to) - worth(b.from) - (worth(a.to) - worth(a.from)))[0]
      return bestMove && worth(bestMove.to) > worth(bestMove.from) ? bestMove : { type: 'leave' }
    }
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
