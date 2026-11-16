import type { SigilId } from '../cards.ts'
import type { ItemId } from '../items.ts'
import type { Action, DeckCard, GameEvent, GameState } from '../engine/types.ts'

export const RUN_RULES_VERSION = 24

export const INTEGRITY = 20

export const RUN_SAVE_LIMIT = 200

export type RunCard = DeckCard & {
  id: number
  added: SigilId | null
}

export type NodeKind = 'battle' | 'card' | 'campfire' | 'stones' | 'event' | 'shop' | 'item' | 'boss'

export type Pick = 'free' | 'costly' | 'sigil' | 'sturdy' | 'sharp'

export type Trial = 'attack' | 'health' | 'sigils'

export type MapNode = {
  id: string
  kind: NodeKind
  row: number
  col: number
  next: string[]
  encounter?: string
  boost?: 'attack' | 'health'
  event?: string
  blind?: boolean
}

export type StageMap = { stage: number; rows: MapNode[][] }

export type Visit =
  | { kind: 'battle'; node: string; game: GameState }
  | { kind: 'card'; node: string; offer: string[] }
  | { kind: 'reward'; offer: string[] }
  | { kind: 'campfire'; node: string; boost: 'attack' | 'health'; card: number | null; buffs: number }
  | { kind: 'stones'; node: string }
  | { kind: 'event'; node: string; event: string }
  | { kind: 'lint'; node: string }
  | { kind: 'start' }
  | { kind: 'pack'; deck: string; opened: number; offer: string[] }
  | {
      kind: 'shop'
      node: string
      offer: { card: string; price: number }[]
      sold: number[]
      uninstalled?: boolean
      tools: { id: ItemId; price: number }[]
      toolsSold: number[]
    }
  | { kind: 'item'; node: string; offer: ItemId[] }
  | { kind: 'fuse'; node: string }
  | { kind: 'blind'; node: string; picks: Pick[]; revealed?: { pick: number; offer: string[] } }

export type RunState = {
  seed: number
  rng: number
  status: 'playing' | 'won' | 'lost'
  stage: number
  map: StageMap
  at: string | null
  visit: Visit | null
  deck: RunCard[]
  nextCard: number
  record: { battles: number; bosses: number; overkill: number }
  bytes: number
  items: ItemId[]
  integrity: number
  pity: number
  death: { card: string; skipped: boolean; offered: boolean } | null
  rival: { card: string; by: string } | null
}

export type RunAction =
  | { type: 'go'; node: string }
  | { type: 'play'; action: Action }
  | { type: 'take'; index: number }
  | { type: 'buff'; card: number }
  | { type: 'repair' }
  | { type: 'transfer'; from: number; to: number; sigil: SigilId }
  | { type: 'choose'; option: number }
  | { type: 'strip'; card: number; sigil: SigilId }
  | { type: 'start'; deck: string; skipDeath?: boolean }
  | { type: 'buy'; index: number }
  | { type: 'buyItem'; index: number }
  | { type: 'pickItem'; index: number; drop?: number }
  | { type: 'uninstall'; card: number }
  | { type: 'fuse'; card: number; with?: number }
  | { type: 'leave' }

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
  | { type: 'fused'; card: RunCard; into: RunCard }
  | { type: 'trialled'; trial: Trial; cards: RunCard[]; total: number; bar: number; passed: boolean }
  | { type: 'repaired'; amount: number; integrity: number }
  | { type: 'integrity'; change: number; integrity: number }
  | { type: 'stageCleared'; stage: number }
  | { type: 'runOver'; outcome: 'win' | 'loss'; integrity?: boolean }

export type RunResult = { ok: true; state: RunState; events: RunEvent[] } | { ok: false; reason: string }
