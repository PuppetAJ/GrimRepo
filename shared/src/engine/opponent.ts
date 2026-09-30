import { card, OPPONENT_POOL, type CardDef } from '../cards.ts'
import { encounter } from '../encounters.ts'
import type { Rng } from '../rng.ts'
import { makeUnit } from './units.ts'
import { LANES, type GameEvent, type GameState, type Slot } from './types.ts'

/** Caps P03's card cost early so a battle starts gently. */
export function maxCostFor(turn: number): number {
  if (turn < 3) return 0
  if (turn < 6) return 1
  if (turn < 10) return 2
  return 3
}

// Tuned against the bots in bot.ts: greedy wins about 28%, lanes about 34%.
const CALM_TURNS = 5
const DOUBLE_CHANCE = 0.35
// How many best-suited cards P03 picks between; wider is kinder.
const CHOICE_WIDTH = 12

export function queueCountFor(turn: number, rng: Rng): number {
  return turn < CALM_TURNS ? 1 : rng.float() < DOUBLE_CHANCE ? 2 : 1
}

/** A zero-attack P03 card that blocks its queue and faces no attacker. */
export function isDeadCode(state: GameState, lane: number): boolean {
  const wall = state.opponent.front[lane]
  const facing = state.player.board[lane]
  return Boolean(wall && wall.attack === 0 && state.opponent.back[lane] && !(facing && facing.attack > 0))
}

/** Clears dead code so the queued card behind can move up. */
export function retireDeadCode(state: GameState, events: GameEvent[]): void {
  for (let lane = 0; lane < LANES; lane++) {
    if (!isDeadCode(state, lane)) continue
    const wall = state.opponent.front[lane] as NonNullable<Slot>
    state.opponent.front[lane] = null
    events.push({ type: 'retired', lane, uid: wall.uid })
  }
}

/** Whether a card queued here would reach the front next turn. */
function willOpen(state: GameState, lane: number): boolean {
  const front = state.opponent.front[lane]
  if (!front) return true
  if (front.attack === 0 && !(state.player.board[lane]?.attack ?? 0)) return true
  const facing = state.player.board[lane]
  return Boolean(facing && facing.attack >= front.health)
}

function fitness(def: CardDef, facing: Slot): number {
  if (!facing) return def.attack * 3 + def.health * 0.5
  if (facing.attack === 0) return def.attack * 3
  const kills = def.attack >= facing.health ? 10 : 0
  const survives = def.health > facing.attack ? 6 : 0
  return kills + survives + def.attack + def.health * 0.5
}

/** Queues only in lanes that open next turn; with none open, holds the rest. */
export function queue(state: GameState, rng: Rng, count: number, turn: number, events: GameEvent[]): void {
  const pool = OPPONENT_POOL.map(card).filter((def) => def.cost <= maxCostFor(turn))
  for (let placed = 0; placed < count; placed++) {
    const open = [...Array(LANES).keys()].filter((lane) => !state.opponent.back[lane] && willOpen(state, lane))
    if (open.length === 0) return
    // Lanes facing an attacker (to answer it) or nothing (to hit the player) count twice.
    const weighted = open.flatMap((lane) => {
      const facing = state.player.board[lane]
      return !facing || facing.attack > 0 ? [lane, lane] : [lane]
    })
    const lane = rng.pick(weighted)
    const facing = state.player.board[lane] ?? null
    const suited = pool
      .filter((def) => def.attack > 0 || (facing?.attack ?? 0) > 0)
      .sort((a, b) => fitness(b, facing) - fitness(a, facing))
    // A pick among the best few keeps P03 sensible but not predictable or merciless.
    const def = rng.pick(suited.slice(0, CHOICE_WIDTH))
    const unit = makeUnit(state, def.id)
    state.opponent.back[lane] = unit
    events.push({ type: 'queued', lane, unit })
  }
}

/** The planned lane, or the free one nearest it. */
function nearestFree(state: GameState, lane: number): number | undefined {
  return [...Array(LANES).keys()]
    .sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane) || a - b)
    .find((candidate) => !state.opponent.back[candidate])
}

/** Queues the encounter's next planned turn, and P03's usual picks once the plan runs out. */
export function queuePlan(state: GameState, rng: Rng, events: GameEvent[]): void {
  const plan = encounter(state.opponent.encounter as string).phases[state.opponent.phase] ?? []
  const turn = plan[state.opponent.step]
  state.opponent.step += 1
  if (!turn) return queue(state, rng, queueCountFor(state.turn, rng), state.turn, events)
  for (const queued of turn) {
    const lane = nearestFree(state, queued.lane)
    if (lane === undefined) return
    const unit = makeUnit(state, 'card' in queued ? queued.card : rng.pick(queued.pick))
    state.opponent.back[lane] = unit
    events.push({ type: 'queued', lane, unit })
  }
}
