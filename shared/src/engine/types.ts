import type { SigilId } from '../cards.ts'

/** Bumped whenever a change would make an old game replay differently; games record the version they began under. */
export const RULES_VERSION = 3

export const LANES = 4
/** The scale tips this far to win: each point of damage to a player moves it one step against them, as in Inscryption. */
export const TIP = 24
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
  /** The damage the player has dealt less the damage taken; at TIP one way or the other, the game is over. */
  scale: number
  player: { deck: string[]; hand: Unit[]; board: Slot[] }
  opponent: { front: Slot[]; back: Slot[] }
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
  | { type: 'hit'; side: Side; amount: number; scale: number }
  | { type: 'retired'; lane: number; uid: number }
  | { type: 'advanced'; lane: number; uid: number }
  | { type: 'queued'; lane: number; unit: Unit }
  | { type: 'healed'; uid: number; amount: number; health: number }
  | { type: 'turnStarted'; turn: number }
  | { type: 'gameOver'; outcome: 'win' | 'loss'; turns: number }

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; reason: string }
