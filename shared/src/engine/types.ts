import type { SigilId } from '../cards.ts'

export const LANES = 4
export const STARTING_HEALTH = 50
export const HAND_LIMIT = 7
/** A game still going at this turn is lost, which also bounds what the server stores. */
export const TURN_LIMIT = 200

/** A card in play or in hand; its numbers can change, so it carries its own copy of them. */
export type Unit = {
  uid: number
  card: string
  attack: number
  health: number
  maxHealth: number
  sigils: SigilId[]
}

export type Slot = Unit | null

export type GameState = {
  seed: number
  rng: number
  turn: number
  /** Whether this turn's draw has happened; nothing else can be done before it. */
  drawn: boolean
  status: 'playing' | 'won' | 'lost'
  nextUid: number
  debug: boolean
  player: { health: number; deck: string[]; hand: Unit[]; board: Slot[] }
  opponent: { health: number; front: Slot[]; back: Slot[] }
  /** A costly card picked from the hand, and the lanes marked to pay for it. */
  summon: { uid: number; marked: number[] } | null
}

export type Action =
  | { type: 'draw'; from: 'deck' | 'boilerplate' }
  | { type: 'select'; uid: number }
  | { type: 'mark'; lane: number }
  | { type: 'unmark'; lane: number }
  | { type: 'cancel' }
  | { type: 'place'; lane: number }
  | { type: 'ringBell' }

export type Side = 'player' | 'opponent'

/** What happened, in order, for the table to play back. */
export type GameEvent =
  | { type: 'drew'; unit: Unit; from: 'deck' | 'boilerplate' }
  | { type: 'reshuffled'; cards: number }
  | { type: 'selected'; uid: number }
  | { type: 'marked'; lane: number }
  | { type: 'unmarked'; lane: number }
  | { type: 'cancelled' }
  | { type: 'sacrificed'; lane: number; uid: number; survived: boolean }
  | { type: 'placed'; lane: number; unit: Unit }
  | { type: 'wiped'; uids: number[] }
  | { type: 'attacked'; side: Side; lane: number; target: number | 'face' }
  | { type: 'damaged'; uid: number; amount: number; health: number }
  | { type: 'overkill'; lane: number; amount: number }
  | { type: 'struckBack'; uid: number; amount: number }
  | { type: 'killed'; uid: number; side: Side; lane: number; row: 'front' | 'back' }
  | { type: 'hit'; side: Side; amount: number; health: number }
  | { type: 'advanced'; lane: number; uid: number }
  | { type: 'queued'; lane: number; unit: Unit }
  | { type: 'healed'; uid: number; amount: number; health: number }
  | { type: 'turnStarted'; turn: number }
  | { type: 'gameOver'; outcome: 'win' | 'loss'; turns: number }

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; reason: string }
