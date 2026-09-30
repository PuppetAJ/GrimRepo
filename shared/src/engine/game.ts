import { BOILERPLATE, card, DEBUG_CARD, PLAYER_DECK } from '../cards.ts'
import { encounter } from '../encounters.ts'
import { Rng } from '../rng.ts'
import { attack } from './combat.ts'
import { queue, queueCountFor, queuePlan, retireDeadCode } from './opponent.ts'
import {
  HAND_LIMIT,
  LANES,
  TIP,
  TURN_LIMIT,
  type Action,
  type DeckCard,
  type GameEvent,
  type GameState,
  type Result,
  type Unit,
} from './types.ts'
import { costOf, deckCard, drawUnit, makeUnit, units, worthOf } from './units.ts'

export type GameOptions = {
  seed: number
  /** Deals the debug card, which ends a game in one turn; development and tests only. */
  debug?: boolean
  /** A run's deck; a quick battle uses the whole card table. */
  deck?: DeckCard[]
  /** P03 follows this encounter's plan instead of picking freely. */
  encounter?: string | null
  /** Deals a card costing 1 or less into the opening hand when the deck has one. */
  fairHand?: boolean
}

export function createGame({ seed, debug = false, deck, encounter = null, fairHand = false }: GameOptions): GameState {
  const rng = new Rng(seed >>> 0)
  const library = deck ? structuredClone(deck) : PLAYER_DECK.map(deckCard)
  const state: GameState = {
    seed: seed >>> 0,
    rng: 0,
    turn: 1,
    drawn: false,
    status: 'playing',
    nextUid: 1,
    debug,
    scale: 0,
    player: { library, deck: rng.shuffle([...library.keys()]), hand: [], board: Array(LANES).fill(null) },
    opponent: { front: Array(LANES).fill(null), back: Array(LANES).fill(null), encounter, phase: 0, step: 0 },
    summon: null,
  }
  if (fairHand) dealFairly(state.player)
  const opening = state.player.deck.splice(0, 3)
  for (const source of opening) state.player.hand.push(drawUnit(state, source))
  // The Boilerplate guarantees the first turn has something to play.
  state.player.hand.push(makeUnit(state, BOILERPLATE))
  if (debug) state.player.hand.push(makeUnit(state, DEBUG_CARD))

  if (encounter) queuePlan(state, rng, [])
  else queue(state, rng, rng.int(1, 3), 0, [])
  state.rng = rng.state
  return state
}

function dealFairly(player: GameState['player']): void {
  const cheap = (source: number) => card((player.library[source] as DeckCard).card).cost <= 1
  if (player.deck.slice(0, 3).some(cheap)) return
  const found = player.deck.findIndex(cheap)
  if (found < 0) return
  const [source] = player.deck.splice(found, 1)
  player.deck.splice(Math.min(2, player.deck.length), 0, source as number)
}

const fail = (reason: string): Result => ({ ok: false, reason })

// A full hand at turn start skips the draw for the whole turn, even after a card is played.
const mustDraw = (state: GameState): boolean => !state.drawn

const paid = (state: GameState): number =>
  (state.summon?.marked ?? []).reduce((sum, lane) => sum + worthOf(state.player.board[lane] as Unit), 0)

const onBoard = (state: GameState): number => units(state.player.board).reduce((sum, unit) => sum + worthOf(unit), 0)

/** Library cards not in hand or on the table, which an empty deck is rebuilt from. */
const outOfPlay = (state: GameState): number[] => {
  const inPlay = new Set([...state.player.hand, ...units(state.player.board)].map((unit) => unit.source))
  return [...state.player.library.keys()].filter((source) => !inPlay.has(source))
}

const validLane = (lane: number): boolean => Number.isInteger(lane) && lane >= 0 && lane < LANES

/** Never mutates the given state. */
export function apply(current: GameState, action: Action): Result {
  if (current.status !== 'playing') return fail('The game is over')
  const state = structuredClone(current)
  const rng = new Rng(state.rng)
  const events: GameEvent[] = []

  if (action.type === 'draw') {
    if (!mustDraw(state))
      return fail(state.player.hand.length >= HAND_LIMIT ? 'The hand is full' : 'No more draws this turn')
    if (action.from === 'deck') {
      if (state.player.deck.length === 0) {
        // Rebuilt without cards in hand or on the table, so no card is ever in two places.
        state.player.deck = rng.shuffle(outOfPlay(state))
        if (state.player.deck.length === 0) return fail('The deck is empty')
        events.push({ type: 'reshuffled', cards: state.player.deck.length })
      }
    }
    const unit =
      action.from === 'deck' ? drawUnit(state, state.player.deck.shift() as number) : makeUnit(state, BOILERPLATE)
    state.player.hand.push(unit)
    state.drawn = true
    events.push({ type: 'drew', unit, from: action.from })
  } else if (mustDraw(state)) {
    return fail('Draw first')
  } else if (action.type === 'select') {
    const unit = state.player.hand.find((candidate) => candidate.uid === action.uid)
    if (!unit) return fail('That card is not in the hand')
    if (costOf(unit) > onBoard(state)) return fail('Not enough on the table to sacrifice')
    if (state.summon) events.push({ type: 'cancelled' })
    state.summon = { uid: unit.uid, marked: [] }
    events.push({ type: 'selected', uid: unit.uid })
  } else if (action.type === 'mark') {
    const summon = state.summon
    if (!summon) return fail('Select a card first')
    if (!validLane(action.lane) || !state.player.board[action.lane]) return fail('Nothing there to sacrifice')
    if (summon.marked.includes(action.lane)) return fail('Already marked')
    const unit = state.player.hand.find((candidate) => candidate.uid === summon.uid) as Unit
    if (paid(state) >= costOf(unit)) return fail('The cost is already paid')
    summon.marked.push(action.lane)
    events.push({ type: 'marked', lane: action.lane })
  } else if (action.type === 'unmark') {
    const summon = state.summon
    if (!summon?.marked.includes(action.lane)) return fail('That lane is not marked')
    summon.marked = summon.marked.filter((lane) => lane !== action.lane)
    events.push({ type: 'unmarked', lane: action.lane })
  } else if (action.type === 'cancel') {
    if (!state.summon) return fail('Nothing is selected')
    state.summon = null
    events.push({ type: 'cancelled' })
  } else if (action.type === 'place') {
    const summon = state.summon
    if (!summon) return fail('Select a card first')
    const unit = state.player.hand.find((candidate) => candidate.uid === summon.uid) as Unit
    if (paid(state) < costOf(unit)) return fail('The cost is not paid')
    if (!validLane(action.lane)) return fail('No such lane')
    const occupant = state.player.board[action.lane]
    const cleared = summon.marked.includes(action.lane) && !occupant?.sigils.includes('try_catch')
    if (occupant && !cleared) return fail('That lane is taken')

    for (const lane of summon.marked) {
      const victim = state.player.board[lane] as Unit
      const survived = victim.sigils.includes('try_catch')
      if (!survived) state.player.board[lane] = null
      events.push({ type: 'sacrificed', lane, uid: victim.uid, survived })
    }
    state.player.hand = state.player.hand.filter((candidate) => candidate.uid !== unit.uid)
    state.player.board[action.lane] = unit
    state.summon = null
    events.push({ type: 'placed', lane: action.lane, unit })

    if (unit.sigils.includes('segfault')) {
      const wiped = [...units(state.opponent.front), ...units(state.opponent.back)].map((victim) => victim.uid)
      state.opponent.front.fill(null)
      state.opponent.back.fill(null)
      events.push({ type: 'wiped', uids: wiped })
    }
  } else if (action.type === 'ringBell') {
    if (state.summon) {
      state.summon = null
      events.push({ type: 'cancelled' })
    }
    playTurn(state, rng, events)
  } else {
    return fail('Unknown action')
  }

  state.rng = rng.state
  return { ok: true, state, events }
}

function playTurn(state: GameState, rng: Rng, events: GameEvent[]): void {
  attack(state, 'player', events)
  if (state.scale >= TIP) {
    if (!nextPhase(state, rng, events)) return finish(state, 'win', events)
  } else {
    retireDeadCode(state, events)
    for (let lane = 0; lane < LANES; lane++) {
      const waiting = state.opponent.back[lane]
      if (waiting && !state.opponent.front[lane]) {
        state.opponent.front[lane] = waiting
        state.opponent.back[lane] = null
        events.push({ type: 'advanced', lane, uid: waiting.uid })
      }
    }

    attack(state, 'opponent', events)
    if (state.scale <= -TIP) return finish(state, 'loss', events)

    if (state.opponent.encounter) queuePlan(state, rng, events)
    else queue(state, rng, queueCountFor(state.turn, rng), state.turn, events)
  }

  for (const unit of [...units(state.player.board), ...units(state.opponent.front), ...units(state.opponent.back)]) {
    if (unit.sigils.includes('hotfix') && unit.health < unit.maxHealth) {
      unit.health += 1
      events.push({ type: 'healed', uid: unit.uid, amount: 1, health: unit.health })
    }
  }

  if (state.turn >= TURN_LIMIT) return finish(state, 'loss', events)
  state.turn += 1
  state.drawn = state.player.hand.length >= HAND_LIMIT
  events.push({ type: 'turnStarted', turn: state.turn })
}

/** A boss with a phase left clears its side and levels the scale instead of losing. */
function nextPhase(state: GameState, rng: Rng, events: GameEvent[]): boolean {
  const id = state.opponent.encounter
  if (!id || state.opponent.phase + 1 >= encounter(id).phases.length) return false
  const uids = [...units(state.opponent.front), ...units(state.opponent.back)].map((unit) => unit.uid)
  state.opponent.front.fill(null)
  state.opponent.back.fill(null)
  state.opponent.phase += 1
  state.opponent.step = 0
  state.scale = 0
  events.push({ type: 'phaseChanged', phase: state.opponent.phase, uids })
  queuePlan(state, rng, events)
  return true
}

function finish(state: GameState, outcome: 'win' | 'loss', events: GameEvent[]): void {
  state.status = outcome === 'win' ? 'won' : 'lost'
  events.push({ type: 'gameOver', outcome, turns: state.turn })
}

export function legalActions(state: GameState): Action[] {
  if (state.status !== 'playing') return []
  if (mustDraw(state)) {
    const draws: Action[] = [{ type: 'draw', from: 'boilerplate' }]
    if (state.player.deck.length || outOfPlay(state).length) draws.push({ type: 'draw', from: 'deck' })
    return draws
  }

  const actions: Action[] = [{ type: 'ringBell' }]
  for (const unit of state.player.hand) {
    if (unit.uid !== state.summon?.uid && costOf(unit) <= onBoard(state))
      actions.push({ type: 'select', uid: unit.uid })
  }
  const summon = state.summon
  if (summon) {
    actions.push({ type: 'cancel' })
    const cost = costOf(state.player.hand.find((unit) => unit.uid === summon.uid) as Unit)
    for (let lane = 0; lane < LANES; lane++) {
      const occupant = state.player.board[lane]
      const marked = summon.marked.includes(lane)
      if (marked) actions.push({ type: 'unmark', lane })
      else if (occupant && paid(state) < cost) actions.push({ type: 'mark', lane })
      if (paid(state) >= cost && (!occupant || (marked && !occupant.sigils.includes('try_catch')))) {
        actions.push({ type: 'place', lane })
      }
    }
  }
  return actions
}

export type Replay = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; index: number; reason: string }

/** Any illegal action invalidates the whole record. */
export function replay(seed: number, actions: readonly Action[], options: Omit<GameOptions, 'seed'> = {}): Replay {
  let state = createGame({ seed, ...options })
  const events: GameEvent[] = []
  for (const [index, action] of actions.entries()) {
    const result = apply(state, action)
    if (!result.ok) return { ok: false, index, reason: result.reason }
    state = result.state
    events.push(...result.events)
  }
  return { ok: true, state, events }
}

export function cardsPlayed(events: readonly GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const event of events) if (event.type === 'placed') counts[event.unit.card] = (counts[event.unit.card] ?? 0) + 1
  return counts
}

export function summary(state: GameState): { outcome: 'win' | 'loss'; turns: number } | null {
  if (state.status === 'playing') return null
  return { outcome: state.status === 'won' ? 'win' : 'loss', turns: state.turn }
}
