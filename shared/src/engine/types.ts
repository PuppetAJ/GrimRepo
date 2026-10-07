import type { SigilId } from '../cards.ts'
import type { ItemId } from '../items.ts'

/** Bumped whenever a change would make an old game replay differently. */
export const RULES_VERSION = 13

export const LANES = 4
/** The most sigils a card carries. */
export const MAX_SIGILS = 3
/** Net damage needed to win, or to lose. */
export const TIP = 24
export const HAND_LIMIT = 7
/** A game still going at this turn is lost, which also bounds what the server stores. */
export const TURN_LIMIT = 200

/** A card as a deck holds it; a run can change its stats and sigils. */
export type DeckCard = { card: string; attack: number; health: number; sigils: SigilId[] }

/** Carries its own stats, since they change in play. */
export type Unit = {
  uid: number
  card: string
  attack: number
  health: number
  maxHealth: number
  sigils: SigilId[]
  /** Its index in the library, for a card drawn from the deck. */
  source?: number
  /** A Rollback card has spent the one hit it shrugs off. */
  rolledBack?: boolean
  /** Which way a Load Balancer card moves next: 1 toward the higher lanes. */
  heading?: 1 | -1
}

export type Slot = Unit | null

export type GameState = {
  seed: number
  rng: number
  turn: number
  /** Also true when a full hand at turn start skipped the draw. */
  drawn: boolean
  status: 'playing' | 'won' | 'lost'
  nextUid: number
  debug: boolean
  /** Damage dealt minus damage taken; the game ends at TIP either way. */
  scale: number
  /** The deck is indices into the library, which holds every card the player brought. */
  /** `spent` holds library cards refactored away, which never come back to the deck that battle. */
  player: { library: DeckCard[]; deck: number[]; hand: Unit[]; board: Slot[]; spent?: number[] }
  /** Without an encounter, P03 queues from its whole pool; `step` is the next turn of the plan. */
  /** `haunt` is a death card P03 adds to its last phase, once; `by` is its maker, or null for the player's own. */
  opponent: {
    front: Slot[]
    back: Slot[]
    encounter: string | null
    phase: number
    step: number
    haunt?: { card: string; by: string | null; played: boolean }
  }
  /** The card being summoned and the lanes marked to pay for it. */
  summon: { uid: number; marked: number[] } | null
  /** Times a run's battle has rebuilt its deck, each after the first costing an Out of Memory card; absent elsewhere. */
  rebuilds?: number
  /** A run's items, carried into the battle and used up there; absent in a quick battle. */
  items?: ItemId[]
  /** Set by the Hourglass: P03 sits out its next turn. */
  skipOpponent?: boolean
}

export type Action =
  | { type: 'draw'; from: 'deck' | 'boilerplate' }
  | { type: 'select'; uid: number }
  | { type: 'mark'; lane: number }
  | { type: 'unmark'; lane: number }
  | { type: 'cancel' }
  | { type: 'place'; lane: number }
  | { type: 'ringBell' }
  /** Uses the item in that slot; `row` and `lane` aim it at a card when it needs one. */
  | { type: 'use'; slot: number; row?: 'board' | 'front' | 'back'; lane?: number }

export type Side = 'player' | 'opponent'

/** In order, for the table to play back. */
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
  | { type: 'indebted'; uid: number; amount: number; scale: number }
  | { type: 'retired'; lane: number; uid: number }
  | { type: 'advanced'; lane: number; uid: number }
  /** `haunt` marks a death card P03 brings into its last phase; `by` names its maker, or null for the player's own. */
  | { type: 'queued'; lane: number; unit: Unit; haunt?: { by: string | null } }
  | { type: 'healed'; uid: number; amount: number; health: number }
  | { type: 'shielded'; uid: number }
  | { type: 'buffed'; uid: number; attack: number; health: number; sigils?: SigilId[] }
  /** A card left in a lane, as a Deprecated card leaves a Boilerplate. */
  | { type: 'leftBehind'; side: Side; lane: number; unit: Unit }
  | { type: 'used'; item: ItemId }
  /** P03's card pulled into the player's lane by the Hook. */
  | { type: 'hooked'; uid: number; lane: number }
  /** A card put into the hand, as the Bottled Boilerplate does, without drawing. */
  | { type: 'gained'; unit: Unit }
  /** P03 sat out its turn, after the Hourglass. */
  | { type: 'skipped' }
  /** `heading` is set when a Load Balancer moves on, which way it will go next. */
  | { type: 'moved'; uid: number; side: Side; from: number; to: number; heading?: 1 | -1 }
  /** A Hot Reload card's copy: back in the player's hand (lane null) or in P03's queue, from the lane it left. */
  | { type: 'reloaded'; side: Side; unit: Unit; from: number; lane: number | null }
  | { type: 'shipped'; uid: number; unit: Unit }
  | { type: 'phaseChanged'; phase: number; uids: number[] }
  | { type: 'turnStarted'; turn: number }
  | { type: 'gameOver'; outcome: 'win' | 'loss'; turns: number }

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; reason: string }
