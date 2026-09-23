import { card, OPPONENT_POOL } from '../cards.ts'
import type { Rng } from '../rng.ts'
import { makeUnit } from './units.ts'
import { LANES, type GameEvent, type GameState } from './types.ts'

/** The dearest card the opponent may queue by this turn, so a battle starts gently. */
export function maxCostFor(turn: number): number {
  if (turn < 3) return 0
  if (turn < 6) return 1
  if (turn < 10) return 2
  return 3
}

/** How many cards the opponent queues at the end of a turn. */
export function queueCountFor(turn: number, rng: Rng): number {
  return turn < 3 ? 1 : rng.float() < 0.5 ? 2 : 1
}

/**
 * Puts cards in empty back-row lanes, where they wait a turn before advancing. Lanes facing an
 * attacker (to block it) or facing nothing (to hit the player) are twice as likely.
 */
export function queue(state: GameState, rng: Rng, count: number, turn: number, events: GameEvent[]): void {
  const pool = OPPONENT_POOL.filter((id) => card(id).cost <= maxCostFor(turn))
  for (let placed = 0; placed < count; placed++) {
    const open = [...Array(LANES).keys()].filter((lane) => !state.opponent.back[lane])
    if (open.length === 0) return
    const weighted = open.flatMap((lane) => {
      const facing = state.player.board[lane]
      return !facing || facing.attack > 0 ? [lane, lane] : [lane]
    })
    const lane = rng.pick(weighted)
    const unit = makeUnit(state, rng.pick(pool))
    state.opponent.back[lane] = unit
    events.push({ type: 'queued', lane, unit })
  }
}
