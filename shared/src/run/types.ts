import type { SigilId } from '../cards.ts'
import type { ItemId } from '../items.ts'
import type { Action, DeckCard, GameEvent, GameState } from '../engine/types.ts'

/** Bumped whenever a change would make an old run replay differently. */
export const RUN_RULES_VERSION = 19

/** The integrity a run starts with, and the most it can hold. */
export const INTEGRITY = 20

/** The most actions one save may send; 200 of the largest kind fit the server's 16 KB body limit. */
export const RUN_SAVE_LIMIT = 200

/** A card in the run's deck; `id` stays the same as the card is changed. */
export type RunCard = DeckCard & {
  id: number
  /** Sigil stones and events add at most one sigil to a card. */
  added: SigilId | null
}

export type NodeKind = 'battle' | 'card' | 'campfire' | 'stones' | 'event' | 'shop' | 'item' | 'boss'

/** What a face-down card choice offers in place of cards: a random card with that trait. */
export type Pick = 'free' | 'costly' | 'sigil' | 'sturdy' | 'sharp'

/** A code review's trials: the total attack, health or sigils of three cards drawn from the deck. */
export type Trial = 'attack' | 'health' | 'sigils'

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
  /** A campfire warms one card, with `boost`, or repairs the run's integrity instead. */
  | { kind: 'campfire'; node: string; boost: 'attack' | 'health'; card: number | null; buffs: number }
  | { kind: 'stones'; node: string }
  | { kind: 'event'; node: string; event: string }
  /** The linter, after its event: one sigil may be deleted from one card. */
  | { kind: 'lint'; node: string }
  /** A run's first choice: which starter deck to take. */
  | { kind: 'start' }
  /** The starter deck's pack, opened: the deck ids of the cards it held. */
  | { kind: 'pack'; cards: number[] }
  /** Cards for bytes; several may be bought before leaving. */
  /** `uninstalled` once a card has been removed for bytes, which a visit allows once. */
  /** `tools` are for sale this visit, with their prices; `toolsSold` holds the places bought. */
  | {
      kind: 'shop'
      node: string
      offer: { card: string; price: number }[]
      sold: number[]
      uninstalled?: boolean
      tools: { id: ItemId; price: number }[]
      toolsSold: number[]
    }
  /** Three items to choose one from, when there's a slot free. */
  | { kind: 'item'; node: string; offer: ItemId[] }
  /** The merge request, after its event: two copies of a card may become one. */
  | { kind: 'fuse'; node: string }
  /** Three traits face down; picking one turns over three cards with it, and one of those is taken. */
  | { kind: 'blind'; node: string; picks: Pick[]; revealed?: { pick: number; offer: string[] } }

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
  /** Tools carried between battles, three at most. */
  items: ItemId[]
  /** What's left of the run's integrity: each card P03 destroys costs 1, and the run is lost at 0. */
  integrity: number
  /** Added to a rare's chance at each card offered: it grows with every common and resets with a rare. */
  pity: number
  /** The player's death card from a lost run: offered once, at the first card choice, unless left out for more score. */
  death: { card: string; skipped: boolean; offered: boolean } | null
  /** Another player's death card, which the Staging boss brings into its last phase; `by` is its maker. */
  rival: { card: string; by: string } | null
}

export type RunAction =
  | { type: 'go'; node: string }
  | { type: 'play'; action: Action }
  | { type: 'take'; index: number }
  | { type: 'buff'; card: number }
  /** At a campfire, repairs the run's integrity instead of warming a card. */
  | { type: 'repair' }
  | { type: 'transfer'; from: number; to: number; sigil: SigilId }
  | { type: 'choose'; option: number }
  | { type: 'strip'; card: number; sigil: SigilId }
  /** `skipDeath` leaves the player's death card out of the run, for a higher score. */
  | { type: 'start'; deck: string; skipDeath?: boolean }
  | { type: 'buy'; index: number }
  | { type: 'buyItem'; index: number }
  /** At an item node, the item in that place; at a full kit, the slot to give up for it. */
  | { type: 'pickItem'; index: number; drop?: number }
  | { type: 'uninstall'; card: number }
  /** `with` names the copy to merge into `card`; without it, the first other copy. */
  | { type: 'fuse'; card: number; with?: number }
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
  | { type: 'gotItem'; item: ItemId; dropped?: ItemId }
  | { type: 'uninstalled'; card: RunCard; price: number }
  /** `card` is the copy kept, with both copies' stats; `into` was folded into it. */
  | { type: 'fused'; card: RunCard; into: RunCard }
  /** A code review: the cards drawn, the trial's total and the bar, and whether it passed. */
  | { type: 'trialled'; trial: Trial; cards: RunCard[]; total: number; bar: number; passed: boolean }
  | { type: 'repaired'; amount: number; integrity: number }
  | { type: 'stageCleared'; stage: number }
  /** `integrity` marks a run lost because its integrity ran out. */
  | { type: 'runOver'; outcome: 'win' | 'loss'; integrity?: boolean }

export type RunResult = { ok: true; state: RunState; events: RunEvent[] } | { ok: false; reason: string }
