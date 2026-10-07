import type { SigilId } from '../cards.ts'
import type { Action, DeckCard, GameEvent, GameState } from '../engine/types.ts'

/** Bumped whenever a change would make an old run replay differently. */
export const RUN_RULES_VERSION = 10

/** The most actions one save may send; 200 of the largest kind fit the server's 16 KB body limit. */
export const RUN_SAVE_LIMIT = 200

/** A card in the run's deck; `id` stays the same as the card is changed. */
export type RunCard = DeckCard & {
  id: number
  /** Sigil stones and events add at most one sigil to a card. */
  added: SigilId | null
}

export type NodeKind = 'battle' | 'card' | 'campfire' | 'stones' | 'event' | 'shop' | 'boss'

/** What a face-down card choice offers in place of cards: a random card with that trait. */
export type Pick = 'free' | 'costly' | 'sigil' | 'sturdy' | 'sharp'

export type MapNode = {
  id: string
  kind: NodeKind
  row: number
  col: number
  /** Ids of the nodes in the next row this one leads to. */
  next: string[]
  encounter?: string
  boost?: 'attack' | 'health'
  event?: string
  /** A card choice that shows only traits, each a random card with it. */
  blind?: boolean
}

export type StageMap = { stage: number; rows: MapNode[][] }

export type Visit =
  | { kind: 'battle'; node: string; game: GameState }
  | { kind: 'card'; node: string; offer: string[] }
  /** The rare card offered after a boss. */
  | { kind: 'reward'; offer: string[] }
  | { kind: 'campfire'; node: string; boost: 'attack' | 'health'; card: number | null; buffs: number }
  | { kind: 'stones'; node: string }
  | { kind: 'event'; node: string; event: string }
  /** The linter, after its event: one sigil may be deleted from one card. */
  | { kind: 'lint'; node: string }
  /** A run's first choice: which starter deck to take. */
  | { kind: 'start' }
  /** Cards for bytes; several may be bought before leaving. */
  | { kind: 'shop'; node: string; offer: { card: string; price: number }[]; sold: number[] }
  | { kind: 'blind'; node: string; picks: Pick[] }

export type RunState = {
  seed: number
  rng: number
  status: 'playing' | 'won' | 'lost'
  stage: number
  map: StageMap
  /** The last node visited on this stage's map, or null before the first. */
  at: string | null
  visit: Visit | null
  deck: RunCard[]
  nextCard: number
  record: { battles: number; bosses: number; overkill: number }
  /** Overkill banked to spend at shops; spending never lowers the score, which counts its own overkill. */
  bytes: number
}

export type RunAction =
  | { type: 'go'; node: string }
  | { type: 'play'; action: Action }
  | { type: 'take'; index: number }
  | { type: 'buff'; card: number }
  | { type: 'transfer'; from: number; to: number; sigil: SigilId }
  | { type: 'choose'; option: number }
  | { type: 'strip'; card: number; sigil: SigilId }
  | { type: 'start'; deck: string }
  | { type: 'buy'; index: number }
  | { type: 'leave' }

/** In order, for the client to show what a run action did. */
export type RunEvent =
  | { type: 'entered'; node: string; kind: NodeKind }
  | { type: 'battle'; events: GameEvent[] }
  | { type: 'added'; card: RunCard }
  | { type: 'changed'; card: RunCard }
  | { type: 'removed'; card: RunCard }
  | { type: 'stripped'; card: RunCard; sigil: SigilId }
  | { type: 'bought'; card: RunCard; price: number }
  | { type: 'stageCleared'; stage: number }
  | { type: 'runOver'; outcome: 'win' | 'loss' }

export type RunResult = { ok: true; state: RunState; events: RunEvent[] } | { ok: false; reason: string }
