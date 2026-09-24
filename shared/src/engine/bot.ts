import { BOILERPLATE } from '../cards.ts'
import { legalActions } from './game.ts'
import { LANES, type Action, type GameState, type Unit } from './types.ts'
import { costOf, units, worthOf } from './units.ts'

const value = (unit: Unit): number => unit.attack * 2 + unit.health

export type Strategy = 'greedy' | 'lanes'

/** A lane P03 has walled off from itself: a card of its own with no attack, and nothing able to move up. */
export const deadLane = (state: GameState, lane: number): boolean => {
  const wall = state.opponent.front[lane]
  return Boolean(wall && wall.attack === 0)
}

/**
 * Where to put a card. Greedy fills lanes facing an enemy first; 'lanes' plays the wall exploit,
 * leaving P03's walled lanes alone and attacking through the others.
 */
function bestLane(state: GameState, allowed: number[], strategy: Strategy): number | undefined {
  if (strategy === 'lanes') {
    const open = allowed.filter((lane) => !deadLane(state, lane))
    const facing = open.filter((lane) => !state.opponent.front[lane])
    return facing[0] ?? open[0] ?? allowed[0]
  }
  const threatened = allowed.filter((lane) => state.opponent.front[lane] || state.opponent.back[lane])
  return threatened[0] ?? allowed[0]
}

/** A plain player. Deterministic, so a seed and a strategy always make the same game. */
export function nextBotAction(state: GameState, strategy: Strategy = 'greedy'): Action {
  const legal = legalActions(state)
  const allowed = (type: Action['type']) => legal.filter((action) => action.type === type)

  if (allowed('draw').length) {
    // Fuel when something in hand cannot be paid for yet, otherwise a real card.
    const short = state.player.hand.some((unit) => costOf(unit) > units(state.player.board).length)
    const hasFuel = state.player.hand.some((unit) => unit.card === BOILERPLATE)
    return { type: 'draw', from: short && !hasFuel ? 'boilerplate' : 'deck' }
  }

  const summon = state.summon
  if (summon) {
    const places = allowed('place') as { type: 'place'; lane: number }[]
    if (places.length)
      return {
        type: 'place',
        lane: bestLane(
          state,
          places.map((p) => p.lane),
          strategy,
        ) as number,
      }
    const marks = allowed('mark') as { type: 'mark'; lane: number }[]
    const cheapest = marks.sort(
      (a, b) => value(state.player.board[a.lane] as Unit) - value(state.player.board[b.lane] as Unit),
    )[0]
    return cheapest ?? { type: 'cancel' }
  }

  const board = units(state.player.board)
  const empty = [...Array(LANES).keys()].filter((lane) => !state.player.board[lane])
  const selectable = (allowed('select') as { type: 'select'; uid: number }[])
    .map((action) => state.player.hand.find((unit) => unit.uid === action.uid) as Unit)
    .sort((a, b) => value(b) - value(a))

  for (const unit of selectable) {
    const cost = costOf(unit)
    if (cost === 0) {
      if (empty.length) return { type: 'select', uid: unit.uid }
      continue
    }
    // Only trade up: what is sacrificed must be worth less than what arrives.
    let paid = 0
    let given = 0
    for (const victim of [...board].sort((a, b) => value(a) - value(b))) {
      if (paid >= cost) break
      paid += worthOf(victim)
      given += value(victim)
    }
    if (paid >= cost && given < value(unit)) return { type: 'select', uid: unit.uid }
  }

  return { type: 'ringBell' }
}

/** Plays a whole game with the bot, for tests and simulations; stops if it ever loops. */
export function playOut(
  state: GameState,
  apply: (s: GameState, a: Action) => GameState,
  { limit = 20_000, strategy = 'greedy' }: { limit?: number; strategy?: Strategy } = {},
) {
  const actions: Action[] = []
  let current = state
  while (current.status === 'playing' && actions.length < limit) {
    const action = nextBotAction(current, strategy)
    actions.push(action)
    current = apply(current, action)
  }
  return { state: current, actions }
}
