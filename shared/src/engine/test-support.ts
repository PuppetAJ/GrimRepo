import assert from 'node:assert/strict'
import { apply, createGame } from './game.ts'
import { LANES, type Action, type GameEvent, type GameState } from './types.ts'
import { drawUnit, makeUnit } from './units.ts'

type Row = (string | null)[]

/** A game past this turn's draw with only the given cards on the table. */
export function table({
  hand = [],
  board = [],
  front = [],
  back = [],
  scale,
}: {
  hand?: string[]
  board?: Row
  front?: Row
  back?: Row
  scale?: number
}): GameState {
  const state = createGame({ seed: 7 })
  // Taken from the library where the card is in it, as a drawn card would be.
  const unit = (id: string) => {
    const source = state.player.library.findIndex((entry) => entry.card === id)
    return source < 0 ? makeUnit(state, id) : drawUnit(state, source)
  }
  const row = (ids: Row) => [...Array(LANES).keys()].map((lane) => (ids[lane] ? unit(ids[lane] as string) : null))
  state.drawn = true
  state.player.hand = hand.map(unit)
  state.player.board = row(board)
  state.opponent.front = row(front)
  state.opponent.back = row(back)
  if (scale !== undefined) state.scale = scale
  return state
}

/** Asserts every action is legal. */
export function play(state: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let current = state
  for (const action of actions) {
    const result = apply(current, action)
    assert.ok(result.ok, `${JSON.stringify(action)} was refused: ${result.ok ? '' : result.reason}`)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

export function refused(state: GameState, action: Action): string {
  const result = apply(state, action)
  assert.ok(!result.ok, `${JSON.stringify(action)} should have been refused`)
  return result.reason
}

export const uidOf = (state: GameState, card: string): number => {
  const unit = state.player.hand.find((candidate) => candidate.card === card)
  assert.ok(unit, `${card} is not in the hand`)
  return unit.uid
}

export const cardAt = (row: GameState['player']['board'], lane: number) => row[lane]?.card ?? null

export const deckCards = (state: GameState): string[] =>
  state.player.deck.map((source) => state.player.library[source]?.card as string)
