import { card, type SigilId } from '../cards.ts'
import { ITEM_SLOTS, type ItemId } from '../items.ts'
import { nextBotAction, type Strategy } from '../engine/bot.ts'
import { findNode } from './map.ts'
import { COMMONS, legalRunActions, PICKS, STARTER_DECKS, TRIALS } from './run.ts'
import { scene, type Effect } from './scenes.ts'
import { INTEGRITY, type RunAction, type RunCard, type RunState, type Trial } from './types.ts'

const value = (entry: { attack: number; health: number }) => entry.attack * 2 + entry.health
const cardValue = (id: string) => value(card(id)) / (card(id).cost + 1)
const best = (deck: RunCard[]) => [...deck].sort((a, b) => value(b) - value(a))[0]

const TOOL_PREFERENCE: ItemId[] = ['hourglass', 'scissors', 'hook', 'pliers', 'bottle', 'hammer']

const DRAWBACKS: SigilId[] = ['technical_debt', 'deprecated']
const drawback = (deck: RunCard[]) =>
  deck.flatMap((entry) =>
    DRAWBACKS.filter((sigil) => entry.sigils.includes(sigil)).map((sigil) => ({ entry, sigil })),
  )[0]

function passChance(deck: RunCard[], trial: Trial): number {
  const { bar, of } = TRIALS[trial]
  if (deck.length <= 3) return deck.reduce((sum, entry) => sum + of(entry), 0) >= bar ? 1 : 0
  let passed = 0
  let draws = 0
  for (let a = 0; a < deck.length; a++)
    for (let b = a + 1; b < deck.length; b++)
      for (let c = b + 1; c < deck.length; c++) {
        draws += 1
        if (of(deck[a] as RunCard) + of(deck[b] as RunCard) + of(deck[c] as RunCard) >= bar) passed += 1
      }
  return passed / draws
}

const RARE_WORTH = 6

const twins = (deck: RunCard[]) =>
  deck.filter((entry) => deck.some((other) => other.id !== entry.id && other.card === entry.card))

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
    case 'fuse':
      return twins(state.deck).length ? 3 : 0
    case 'item':
      return state.items.length < ITEM_SLOTS ? 2 : 0
    case 'integrity':
      return effect.amount
    case 'trial':
      return passChance(state.deck, effect.trial) * RARE_WORTH
  }
}

const PREFERRED = ['card', 'shop', 'campfire', 'event', 'stones', 'battle', 'boss']

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
      const ids = Object.keys(STARTER_DECKS)
      return { type: 'start', deck: deck ?? (ids[state.seed % ids.length] as string) }
    }
    case 'blind': {
      if (visit.revealed) {
        const values = visit.revealed.offer.map(cardValue)
        return { type: 'take', index: values.indexOf(Math.max(...values)) }
      }
      const worth = visit.picks.map((pick) => {
        const pool = COMMONS.filter(PICKS[pick].fits)
        return pool.reduce((sum, id) => sum + cardValue(id), 0) / Math.max(1, pool.length)
      })
      return { type: 'take', index: worth.indexOf(Math.max(...worth)) }
    }
    case 'shop': {
      const buys = legal.filter((action): action is Extract<RunAction, { type: 'buy' }> => action.type === 'buy')
      const best = [...buys].sort(
        (a, b) => cardValue(visit.offer[b.index]?.card as string) - cardValue(visit.offer[a.index]?.card as string),
      )[0]
      if (best && cardValue(visit.offer[best.index]?.card as string) > average) return best
      const tool = legal.find((action) => action.type === 'buyItem')
      if (tool) return tool
      const worth = (entry: RunCard) => value(entry) / (card(entry.card).cost + 1)
      const weakest = [...state.deck].sort((x, y) => worth(x) - worth(y))[0]
      const shed = weakest && legal.some((action) => action.type === 'uninstall' && action.card === weakest.id)
      return shed && state.deck.length > 6 && worth(weakest) < average * 0.6
        ? { type: 'uninstall', card: weakest.id }
        : { type: 'leave' }
    }
    case 'item': {
      const best = [...visit.offer].sort((a, b) => TOOL_PREFERENCE.indexOf(a) - TOOL_PREFERENCE.indexOf(b))[0]
      const index = best ? visit.offer.indexOf(best) : -1
      return index >= 0 && state.items.length < ITEM_SLOTS ? { type: 'pickItem', index } : { type: 'leave' }
    }
    case 'fuse': {
      const best = [...twins(state.deck)].sort((a, b) => value(b) - value(a))[0]
      return best ? { type: 'fuse', card: best.id } : { type: 'leave' }
    }
    case 'battle':
      return visit.game.status === 'won'
        ? { type: 'leave' }
        : { type: 'play', action: nextBotAction(visit.game, strategy) }
    case 'card':
    case 'reward':
    case 'pack': {
      const scores = visit.offer.map(cardValue)
      return { type: 'take', index: scores.indexOf(Math.max(...scores)) }
    }
    case 'campfire': {
      if (visit.buffs === 0 && state.integrity <= INTEGRITY / 2) return { type: 'repair' }
      const target = best(state.deck)
      return visit.buffs === 0 && target ? { type: 'buff', card: target.id } : { type: 'leave' }
    }
    case 'event': {
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
      const worth = (id: number) => value(state.deck.find((entry) => entry.id === id) as RunCard)
      const moves = legal.filter((action) => action.type === 'transfer')
      const bestMove = [...moves].sort((a, b) => worth(b.to) - worth(b.from) - (worth(a.to) - worth(a.from)))[0]
      return bestMove && worth(bestMove.to) > worth(bestMove.from) ? bestMove : { type: 'leave' }
    }
  }
}

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
