import { BOILERPLATE, type SigilId } from '../cards.ts'
import { legalActions } from './game.ts'
import { LANES, type Action, type GameState, type Unit } from './types.ts'
import { canOwe, costOf, indebted, units, worthOf } from './units.ts'

const value = (unit: Unit): number => unit.attack * 2 + unit.health

export type Strategy = 'greedy' | 'lanes'

/** A lane P03 has walled off with a zero-attack card. */
export const deadLane = (state: GameState, lane: number): boolean => {
  const wall = state.opponent.front[lane]
  return Boolean(wall && wall.attack === 0)
}

/** 'lanes' plays the wall exploit, leaving walled lanes alone; greedy fills threatened lanes first. */
function bestLane(state: GameState, allowed: number[], strategy: Strategy): number | undefined {
  if (strategy === 'lanes') {
    const open = allowed.filter((lane) => !deadLane(state, lane))
    const facing = open.filter((lane) => !state.opponent.front[lane])
    return facing[0] ?? open[0] ?? allowed[0]
  }
  const threatened = allowed.filter((lane) => state.opponent.front[lane] || state.opponent.back[lane])
  return threatened[0] ?? allowed[0]
}

// P03's sigils worth pulling with the Pliers.
const DANGEROUS: SigilId[] = [
  'fatal_error',
  'rollback',
  'rate_limiter',
  'fork',
  'broadcast',
  'retry',
  'bypass',
  'hot_reload',
]

/** An item worth using now, if any: each only when it clearly pays. */
function itemMove(state: GameState, legal: Action[]): Action | undefined {
  const uses = legal.filter((action): action is Extract<Action, { type: 'use' }> => action.type === 'use')
  const itemOf = (action: Extract<Action, { type: 'use' }>) => state.items?.[action.slot]
  const at = (action: Extract<Action, { type: 'use' }>) =>
    action.lane === undefined ? null : (action.row === 'back' ? state.opponent.back : state.opponent.front)[action.lane]
  const threat = units(state.opponent.front).reduce((sum, unit) => sum + unit.attack, 0)
  const best = (item: string, fits: (unit: Unit) => boolean) =>
    uses
      .filter((action) => itemOf(action) === item && at(action) && fits(at(action) as Unit))
      .sort((a, b) => value(at(b) as Unit) - value(at(a) as Unit))[0]
  const free = state.player.board.filter((slot) => !slot).length
  return (
    uses.find((action) => itemOf(action) === 'hourglass' && threat >= 5) ??
    best('scissors', (unit) => value(unit) >= 10) ??
    best('pliers', (unit) => unit.sigils.some((sigil) => DANGEROUS.includes(sigil))) ??
    best('hook', (unit) => value(unit) >= 8) ??
    uses.find(
      (action) =>
        itemOf(action) === 'bottle' &&
        free > 0 &&
        state.player.hand.some((unit) => costOf(unit) > units(state.player.board).length),
    )
  )
}

/** Deterministic, so a seed and strategy always make the same game. */
export function nextBotAction(state: GameState, strategy: Strategy = 'greedy'): Action {
  const legal = legalActions(state)
  const allowed = (type: Action['type']) => legal.filter((action) => action.type === type)

  if (allowed('draw').length) {
    // Boilerplate only when something in hand can't be paid for yet.
    const short = state.player.hand.some((unit) => costOf(unit) > units(state.player.board).length)
    const hasFuel = state.player.hand.some((unit) => unit.card === BOILERPLATE)
    const deck = allowed('draw').some((action) => action.type === 'draw' && action.from === 'deck')
    return { type: 'draw', from: deck && !(short && !hasFuel) ? 'deck' : 'boilerplate' }
  }

  const summon = state.summon
  const tool = summon ? undefined : itemMove(state, legal)
  if (tool) return tool
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
    let freed = false
    let debts = 0
    for (const victim of [...board].sort((a, b) => value(a) - value(b))) {
      if (paid >= cost) break
      // A debt that would lose the game can't be taken on.
      if (indebted(victim) && !canOwe(state, debts + 1)) continue
      if (indebted(victim)) debts += 1
      paid += worthOf(victim)
      given += value(victim)
      freed ||= !victim.sigils.includes('try_catch')
    }
    // A try/catch card survives its sacrifice, so the new card needs a free lane or another sacrifice to make one.
    if (paid >= cost && given < value(unit) && (empty.length || freed)) return { type: 'select', uid: unit.uid }
  }

  return { type: 'ringBell' }
}

/** Stops at limit in case the bot ever loops. */
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
