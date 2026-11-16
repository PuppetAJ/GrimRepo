import type { SigilId } from '../cards.ts'
import type { ItemId } from '../items.ts'

export const RULES_VERSION = 19

export const LANES = 4
export const MAX_SIGILS = 3
export const TIP = 24
export const HAND_LIMIT = 7
export const TURN_LIMIT = 200

export type DeckCard = { card: string; attack: number; health: number; sigils: SigilId[] }

export type Unit = {
  uid: number
  card: string
  attack: number
  health: number
  maxHealth: number
  sigils: SigilId[]
  source?: number
  rolledBack?: boolean
  stayedUp?: boolean
  heading?: 1 | -1
}

export type Slot = Unit | null

export type GameState = {
  seed: number
  rng: number
  turn: number
  drawn: boolean
  catchUp?: boolean
  status: 'playing' | 'won' | 'lost'
  nextUid: number
  debug: boolean
  scale: number
  player: { library: DeckCard[]; deck: number[]; hand: Unit[]; board: Slot[]; spent?: number[] }
  opponent: {
    front: Slot[]
    back: Slot[]
    encounter: string | null
    phase: number
    step: number
    haunt?: { card: string; by: string | null; played: boolean }
    desperate?: boolean
  }
  summon: { uid: number; marked: number[] } | null
  rebuilds?: number
  items?: ItemId[]
  skipOpponent?: boolean
  integrity?: { left: number; max: number }
  scripted?: boolean
  placed?: number[]
}

export type Action =
  | { type: 'draw'; from: 'deck' | 'boilerplate' }
  | { type: 'select'; uid: number }
  | { type: 'mark'; lane: number }
  | { type: 'unmark'; lane: number }
  | { type: 'cancel' }
  | { type: 'place'; lane: number }
  | { type: 'ringBell' }
  | { type: 'use'; slot: number; row?: 'board' | 'front' | 'back'; lane?: number }

export type Side = 'player' | 'opponent'

export type GameEvent =
  | { type: 'drew'; unit: Unit; from: 'deck' | 'boilerplate'; catchUp?: boolean }
  | { type: 'reshuffled'; cards: number }
  | { type: 'selected'; uid: number }
  | { type: 'marked'; lane: number }
  | { type: 'unmarked'; lane: number }
  | { type: 'cancelled' }
  | { type: 'sacrificed'; lane: number; uid: number; survived: boolean }
  | { type: 'placed'; lane: number; unit: Unit }
  | { type: 'wiped'; uids: number[] }
  | { type: 'attacked'; side: Side; lane: number; target: number | 'face'; aimed: number }
  | { type: 'damaged'; uid: number; amount: number; health: number }
  | { type: 'overkill'; lane: number; amount: number }
  | { type: 'struckBack'; uid: number; amount: number }
  | { type: 'stayedUp'; uid: number }
  | { type: 'killed'; uid: number; side: Side; lane: number; row: 'front' | 'back' }
  | { type: 'hit'; side: Side; amount: number; scale: number }
  | { type: 'indebted'; uid: number; amount: number; scale: number }
  | { type: 'retired'; lane: number; uid: number }
  | { type: 'advanced'; lane: number; uid: number }
  | { type: 'queued'; lane: number; unit: Unit; haunt?: { by: string | null }; desperate?: boolean }
  | { type: 'healed'; uid: number; amount: number; health: number }
  | { type: 'integrity'; uid: number; change: number; left: number }
  | { type: 'shielded'; uid: number }
  | { type: 'buffed'; uid: number; attack: number; health: number; sigils?: SigilId[] }
  | { type: 'leftBehind'; side: Side; lane: number; unit: Unit }
  | { type: 'used'; item: ItemId }
  | { type: 'hooked'; uid: number; lane: number }
  | { type: 'gained'; unit: Unit }
  | { type: 'skipped' }
  | { type: 'moved'; uid: number; side: Side; from: number; to: number; heading?: 1 | -1 }
  | { type: 'reloaded'; side: Side; unit: Unit; from: number; lane: number | null }
  | { type: 'shipped'; uid: number; unit: Unit }
  | { type: 'phaseChanged'; phase: number; uids: number[] }
  | { type: 'turnStarted'; turn: number }
  | { type: 'gameOver'; outcome: 'win' | 'loss'; turns: number }

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; reason: string }
