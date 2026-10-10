import { PLAYER_DECK, card, parseDeathCard, type SigilId } from '../cards.ts'
import { STAGES } from '../encounters.ts'
import { apply, createGame, legalActions } from '../engine/game.ts'
import { broken } from '../engine/combat.ts'
import { MAX_SIGILS, TIP, type DeckCard } from '../engine/types.ts'
import { deckCard } from '../engine/units.ts'
import { Rng } from '../rng.ts'
import { findNode, generateStage } from './map.ts'
import { scene, type Effect } from './scenes.ts'
import { rivalAllowed } from './death.ts'
import { FOUND_ITEMS, ITEM_SLOTS, type ItemId } from '../items.ts'
import {
  INTEGRITY,
  type MapNode,
  type Pick,
  type RunAction,
  type RunCard,
  type RunEvent,
  type RunResult,
  type RunState,
  type Trial,
  type Visit,
} from './types.ts'

export type Rarity = 'common' | 'uncommon' | 'rare'

/** The decks a run can start with, chosen as its first action: a core, and a card taken from each of its packs. */
export const STARTER_DECKS: Record<
  string,
  { name: string; about: string; core: string[]; pack: Record<Rarity, string[]> }
> = {
  'hello-world': {
    name: 'Hello, World',
    about: 'Steady: Reliable and balanced between defense and offense.',
    core: ['HelloWorld', 'CronJob'],
    pack: {
      common: ['Watchdog', 'SpamBot', 'InfiniteLoop'],
      uncommon: ['MergeConflict', 'Sandbox', 'Cookie'],
      rare: ['GrimRepo', 'ReplyAll'],
    },
  },
  'legacy-stack': {
    name: 'Legacy Stack',
    about: 'Defense and sacrifices: Hold the line, and pay for high cost cards early.',
    core: ['OffCenterDiv', 'COBOL'],
    pack: { common: ['CronJob', 'SpamBot'], uncommon: ['LegacyCode', 'Monolith', 'Firewall'], rare: ['Bug'] },
  },
  'move-fast': {
    name: 'Move Fast',
    about: 'Glass Cannon: Hit hard, and hope.',
    core: ['CopyPaste', 'SpamBot'],
    pack: {
      common: ['InfiniteLoop', 'CronJob', 'Prototype'],
      uncommon: ['ZeroDay', 'Crawler', 'SQLInjection'],
      rare: ['ReplyAll', 'NullPointer'],
    },
  },
}

/** How many packs a starter deck opens, one card taken from each. */
export const PACKS = 2
/** How many cards each starter pack holds. */
export const PACK_SIZE = 3

/** A starter pack's cards: one uncommon or better, at the plain odds, since the pity offset would hold a rare at 0. */
const openPack = (state: RunState, rng: Rng, deck: string): string[] =>
  offerCards(state, rng, PACK_SIZE, (STARTER_DECKS[deck] as (typeof STARTER_DECKS)[string]).pack, {
    floored: 1,
    pity: false,
  })

/** What a card costs at a shop, in bytes, by tier. */
const PRICE: Record<string, number> = { E: 3, D: 5, C: 6, B: 12, A: 15 }

/** How many different tools a shop sells. */
const SHOP_TOOLS = 2

/** What removing a card at a shop costs, in bytes; once a visit. */
export const UNINSTALL_PRICE = 4

/** A code review's bar for each trial, over three cards drawn from the deck. */
export const TRIALS: Record<Trial, { bar: number; of: (entry: RunCard) => number }> = {
  attack: { bar: 6, of: (entry) => entry.attack },
  health: { bar: 10, of: (entry) => entry.health },
  sigils: { bar: 2, of: (entry) => entry.sigils.length },
}

/** Cards held twice or more, which a merge request can fold together. */
const duplicated = (state: RunState, entry: RunCard) =>
  state.deck.some((other) => other.id !== entry.id && other.card === entry.card)

/** The traits a face-down card choice can offer, each the commons that have it. */
export const PICKS: Record<Pick, { label: string; fits: (id: string) => boolean }> = {
  free: { label: 'Costs nothing', fits: (id) => card(id).cost === 0 },
  costly: { label: 'Costs 1 or more', fits: (id) => card(id).cost >= 1 },
  sigil: { label: 'Carries a sigil', fits: (id) => card(id).sigils.length > 0 },
  sturdy: { label: '4 or more health', fits: (id) => card(id).health >= 4 },
  sharp: { label: '3 or more attack', fits: (id) => card(id).attack >= 3 },
}
const OFFER_SIZE = 3
const MAX_BUFFS = 2
/** The chance that a second buff at the same campfire burns the card. */
const BURN_CHANCE = 0.5

// Tiers A and B are rares, offered after a boss; only B also turns up, rarely, at card choices.
const isRare = (id: string) => ['A', 'B'].includes(card(id).tier)
export const COMMONS = PLAYER_DECK.filter((id) => !isRare(id))
const RARES = PLAYER_DECK.filter(isRare)

/** What a card choice draws from for each rarity. */
export const CHOICE_POOLS: Record<Rarity, string[]> = {
  common: PLAYER_DECK.filter((id) => ['E', 'D'].includes(card(id).tier)),
  uncommon: PLAYER_DECK.filter((id) => card(id).tier === 'C'),
  rare: PLAYER_DECK.filter((id) => card(id).tier === 'B'),
}

/** Slay the Spire's odds, in percent, for each card offered: 3 rare and 37 uncommon, the rest common. */
const RARE_PERCENT = 3
const UNCOMMON_PERCENT = 37
/** The pity offset added to the rare odds: it starts below 0, grows with each common and resets with a rare. */
export const PITY_START = -5
const PITY_CAP = 40

/** What a campfire's repair restores. */
export const REPAIR = 5

/** Rolls one offered card's rarity; with `pity` the offset counts, and moves. `floor` lifts a common to uncommon. */
function rollRarity(state: RunState, rng: Rng, floor: boolean, pity: boolean): Rarity {
  const roll = rng.int(0, 99)
  const rare = Math.max(0, RARE_PERCENT + (pity ? state.pity : 0))
  const rarity: Rarity = roll < rare ? 'rare' : roll < rare + UNCOMMON_PERCENT || floor ? 'uncommon' : 'common'
  if (!pity) return rarity
  if (rarity === 'rare') state.pity = PITY_START
  else if (rarity === 'common') state.pity = Math.min(PITY_CAP, state.pity + 1)
  return rarity
}

/** Cards to offer, of rolled rarities, none twice while the pool allows; `floored` slots are uncommon or better. */
function offerCards(
  state: RunState,
  rng: Rng,
  count: number,
  pools: Record<Rarity, string[]>,
  { floored = 0, pity = true } = {},
): string[] {
  const offer: string[] = []
  for (let slot = 0; slot < count; slot++) {
    const pool = pools[rollRarity(state, rng, slot < floored, pity)]
    const fresh = pool.filter((id) => !offer.includes(id))
    offer.push(rng.pick(fresh.length ? fresh : pool))
  }
  return rng.shuffle(offer)
}

const fail = (reason: string): RunResult => ({ ok: false, reason })

function newCard(state: RunState, id: string): RunCard {
  state.nextCard += 1
  return { id: state.nextCard - 1, added: null, ...deckCard(id) }
}

const toDeckCard = ({ card: id, attack, health, sigils }: RunCard): DeckCard => ({
  card: id,
  attack,
  health,
  sigils: [...sigils],
})

/** What the server deals a run as it starts: the player's own death card and another player's. */
export type RunDealt = { death?: string | null; rival?: { card: string; by: string } | null }

/** A malformed death card, or another player's over the cap, is ignored. */
export function createRun({ seed, death = null, rival = null }: { seed: number } & RunDealt): RunState {
  const rng = new Rng(seed >>> 0)
  const state: RunState = {
    seed: seed >>> 0,
    rng: 0,
    status: 'playing',
    stage: 0,
    map: generateStage(0, rng),
    at: null,
    // The run's first action chooses its starter deck.
    visit: { kind: 'start' },
    deck: [],
    nextCard: 1,
    record: { battles: 0, bosses: 0, overkill: 0 },
    bytes: 0,
    items: [],
    integrity: INTEGRITY,
    pity: PITY_START,
    death: death && parseDeathCard(death) ? { card: death, skipped: false, offered: false } : null,
    rival: rival && rivalAllowed(rival.card) ? { card: rival.card, by: rival.by } : null,
  }
  state.rng = rng.state
  return state
}

/** The node ids the player can move to next; none while a node is being resolved. */
export function reachable(state: RunState): string[] {
  if (state.status !== 'playing' || state.visit) return []
  if (state.at === null) return (state.map.rows[0] ?? []).map((node) => node.id)
  return findNode(state.map, state.at)?.next ?? []
}

function enter(state: RunState, rng: Rng, node: MapNode): Visit {
  switch (node.kind) {
    case 'battle':
    case 'boss':
      return {
        kind: 'battle',
        node: node.id,
        game: createGame({
          seed: Math.floor(rng.float() * 2 ** 32),
          deck: state.deck.map(toDeckCard),
          encounter: node.encounter ?? null,
          fairHand: true,
          outOfMemory: true,
          items: state.items,
          haunt: node.kind === 'boss' ? haunting(state) : null,
          integrity: { left: state.integrity, max: INTEGRITY },
        }),
      }
    case 'card':
      if (node.blind) {
        const picks = (Object.keys(PICKS) as Pick[]).filter((pick) => COMMONS.some(PICKS[pick].fits))
        return { kind: 'blind', node: node.id, picks: rng.shuffle(picks).slice(0, OFFER_SIZE) }
      }
      // The death card takes one of the three places at the run's first card choice.
      if (state.death && !state.death.skipped && !state.death.offered) {
        state.death.offered = true
        const offer = [state.death.card, ...offerCards(state, rng, OFFER_SIZE - 1, CHOICE_POOLS)]
        return { kind: 'card', node: node.id, offer: rng.shuffle(offer) }
      }
      return { kind: 'card', node: node.id, offer: offerCards(state, rng, OFFER_SIZE, CHOICE_POOLS) }
    case 'shop': {
      // Two commons and a rare, priced by tier.
      const cards = [...rng.shuffle(COMMONS).slice(0, 2), ...rng.shuffle(RARES).slice(0, 1)]
      const offer = cards.map((id) => ({ card: id, price: PRICE[card(id).tier] ?? 10 }))
      // Now and then a tool too; Scissors are found nowhere else.
      // Two tools too; Scissors are found nowhere else.
      const tools = rng
        .shuffle<ItemId>(['scissors', ...FOUND_ITEMS])
        .slice(0, SHOP_TOOLS)
        .map((tool) => ({ id: tool, price: tool === 'scissors' ? 10 : 6 }))
      return { kind: 'shop', node: node.id, offer, sold: [], tools, toolsSold: [] }
    }
    case 'item':
      return { kind: 'item', node: node.id, offer: rng.shuffle(FOUND_ITEMS).slice(0, OFFER_SIZE) }
    case 'campfire':
      return { kind: 'campfire', node: node.id, boost: node.boost ?? 'health', card: null, buffs: 0 }
    case 'stones':
      return { kind: 'stones', node: node.id }
    case 'event':
      return { kind: 'event', node: node.id, event: node.event as string }
  }
}

/** The Staging boss brings another player's death card; the last boss brings the player's own, left out or not. */
function haunting(state: RunState): { card: string; by: string | null } | null {
  if (state.stage === 1 && state.rival) return { card: state.rival.card, by: state.rival.by }
  if (state.stage === STAGES.length - 1 && state.death) return { card: state.death.card, by: null }
  return null
}

function remove(state: RunState, target: RunCard, events: RunEvent[]): void {
  state.deck = state.deck.filter((entry) => entry.id !== target.id)
  events.push({ type: 'removed', card: target })
}

/** Sigils a card can't hold together: with Fork's two lanes and Broadcast's three, one would do nothing. */
const CLASHES: [SigilId, SigilId][] = [['fork', 'broadcast']]
const clashes = (sigils: SigilId[], sigil: SigilId): boolean =>
  CLASHES.some(([one, other]) => (sigil === one && sigils.includes(other)) || (sigil === other && sigils.includes(one)))

const canGain = (target: RunCard, sigil: SigilId): boolean =>
  !target.added && !target.sigils.includes(sigil) && target.sigils.length < MAX_SIGILS && !clashes(target.sigils, sigil)

function addSigil(target: RunCard, sigil: SigilId, events: RunEvent[]): void {
  target.sigils.push(sigil)
  target.added = sigil
  events.push({ type: 'changed', card: target })
}

function resolve(state: RunState, rng: Rng, effect: Effect, events: RunEvent[]): void {
  if (effect.type === 'addCard') {
    const added = newCard(state, effect.card)
    state.deck.push(added)
    events.push({ type: 'added', card: added })
  } else if (effect.type === 'removeCard') {
    // A run never loses its last card.
    if (state.deck.length > 1) remove(state, rng.pick(state.deck), events)
  } else if (effect.type === 'lint' || effect.type === 'fuse') {
    // The caller opens the linter or the merge request, since it knows the node.
  } else if (effect.type === 'item') {
    if (state.items.length < ITEM_SLOTS) {
      const found = rng.pick(FOUND_ITEMS)
      state.items.push(found)
      events.push({ type: 'gotItem', item: found })
    }
  } else if (effect.type === 'trial') {
    const { bar, of } = TRIALS[effect.trial]
    const cards = rng.shuffle([...state.deck]).slice(0, 3)
    const total = cards.reduce((sum, entry) => sum + of(entry), 0)
    const passed = total >= bar
    events.push({ type: 'trialled', trial: effect.trial, cards, total, bar, passed })
    if (passed) {
      const added = newCard(state, rng.pick(RARES))
      state.deck.push(added)
      events.push({ type: 'added', card: added })
    }
  } else if (effect.type === 'duplicate') {
    // A copy keeps the card's buffs and sigils, as a fork would.
    const source = rng.pick(state.deck)
    const copy = { ...source, id: state.nextCard, sigils: [...source.sigils] }
    state.nextCard += 1
    state.deck.push(copy)
    events.push({ type: 'added', card: copy })
  } else if (effect.type === 'boost') {
    const target = rng.pick(state.deck)
    target.attack += effect.attack
    target.health += effect.health
    events.push({ type: 'changed', card: target })
  } else {
    const candidates = state.deck.filter((entry) => canGain(entry, effect.sigil))
    if (candidates.length) addSigil(rng.pick(candidates), effect.sigil, events)
  }
}

function end(state: RunState, outcome: 'win' | 'loss', events: RunEvent[], integrity = false): void {
  state.status = outcome === 'win' ? 'won' : 'lost'
  events.push({ type: 'runOver', outcome, ...(integrity ? { integrity } : {}) })
}

/** Counts a won battle; beating the last boss wins the run. */
function won(state: RunState, visit: Extract<Visit, { kind: 'battle' }>, events: RunEvent[]): void {
  state.record.battles += 1
  const overkill = Math.max(0, visit.game.scale - TIP)
  state.record.overkill += overkill
  state.bytes += overkill
  if (findNode(state.map, visit.node)?.kind !== 'boss') return
  state.record.bosses += 1
  events.push({ type: 'stageCleared', stage: state.stage })
  if (state.stage === STAGES.length - 1) end(state, 'win', events)
}

function step(state: RunState, rng: Rng, action: RunAction, events: RunEvent[]): string | undefined {
  const visit = state.visit
  const inDeck = (id: number) => state.deck.find((entry) => entry.id === id)

  switch (action.type) {
    case 'go': {
      if (visit) return 'Finish this node first'
      if (!reachable(state).includes(action.node)) return 'That node is not reachable from here'
      const node = findNode(state.map, action.node) as MapNode
      state.at = node.id
      events.push({ type: 'entered', node: node.id, kind: node.kind })
      state.visit = enter(state, rng, node)
      return
    }
    case 'play': {
      if (visit?.kind !== 'battle') return 'Not in a battle'
      const result = apply(visit.game, action.action)
      if (!result.ok) return result.reason
      visit.game = result.state
      state.integrity = result.state.integrity?.left ?? state.integrity
      events.push({ type: 'battle', events: result.events })
      if (result.state.status === 'lost') end(state, 'loss', events, broken(result.state))
      if (result.state.status === 'won') won(state, visit, events)
      return
    }
    case 'start': {
      if (visit?.kind !== 'start') return 'The run has already started'
      const deck = STARTER_DECKS[action.deck]
      if (!deck) return 'No such starter deck'
      if (action.skipDeath) {
        if (!state.death) return 'There is no death card to leave out'
        state.death.skipped = true
      }
      for (const id of deck.core) state.deck.push(newCard(state, id))
      state.visit = { kind: 'pack', deck: action.deck, opened: 1, offer: openPack(state, rng, action.deck) }
      return
    }
    case 'buy': {
      if (visit?.kind !== 'shop') return 'There is no shop here'
      const item = Number.isInteger(action.index) ? visit.offer[action.index] : undefined
      if (!item) return 'No such card for sale'
      if (visit.sold.includes(action.index)) return 'That card is sold'
      if (state.bytes < item.price) return 'Not enough bytes'
      state.bytes -= item.price
      visit.sold.push(action.index)
      const bought = newCard(state, item.card)
      state.deck.push(bought)
      events.push({ type: 'bought', card: bought, price: item.price })
      return
    }
    case 'take': {
      if (visit?.kind === 'pack') {
        const id = Number.isInteger(action.index) ? visit.offer[action.index] : undefined
        if (id === undefined) return 'No such card in the pack'
        const added = newCard(state, id)
        state.deck.push(added)
        events.push({ type: 'added', card: added })
        state.visit =
          visit.opened < PACKS ? { ...visit, opened: visit.opened + 1, offer: openPack(state, rng, visit.deck) } : null
        return
      }
      if (visit?.kind === 'blind') {
        if (!visit.revealed) {
          const pick = Number.isInteger(action.index) ? visit.picks[action.index] : undefined
          if (!pick) return 'No such choice'
          visit.revealed = {
            pick: action.index,
            offer: rng.shuffle(COMMONS.filter(PICKS[pick].fits)).slice(0, OFFER_SIZE),
          }
          return
        }
        const id = Number.isInteger(action.index) ? visit.revealed.offer[action.index] : undefined
        if (id === undefined) return 'No such card on offer'
        const added = newCard(state, id)
        state.deck.push(added)
        events.push({ type: 'added', card: added })
        state.visit = null
        return
      }
      if (visit?.kind !== 'card' && visit?.kind !== 'reward') return 'Nothing is on offer'
      const id = Number.isInteger(action.index) ? visit.offer[action.index] : undefined
      if (id === undefined) return 'No such card on offer'
      const added = newCard(state, id)
      state.deck.push(added)
      events.push({ type: 'added', card: added })
      state.visit = null
      if (visit.kind === 'reward') {
        state.stage += 1
        state.map = generateStage(state.stage, rng)
        state.at = null
      }
      return
    }
    case 'buff': {
      if (visit?.kind !== 'campfire') return 'There is no campfire here'
      if (visit.buffs >= MAX_BUFFS) return 'The campfire has gone out'
      if (visit.card !== null && action.card !== visit.card) return 'Only the card already buffed can go back in'
      const target = inDeck(action.card)
      if (!target) return 'That card is not in the deck'
      if (visit.buffs > 0 && state.deck.length <= 1) return 'The last card in the deck is too precious to risk'
      if (visit.buffs > 0 && rng.float() < BURN_CHANCE) {
        remove(state, target, events)
        state.visit = null
        return
      }
      if (visit.boost === 'attack') target.attack += 1
      else target.health += 2
      visit.card = target.id
      visit.buffs += 1
      events.push({ type: 'changed', card: target })
      return
    }
    case 'repair': {
      if (visit?.kind !== 'campfire') return 'There is no campfire here'
      if (visit.buffs > 0) return 'The campfire is already warming a card'
      if (state.integrity >= INTEGRITY) return 'Integrity is already full'
      const amount = Math.min(REPAIR, INTEGRITY - state.integrity)
      state.integrity += amount
      events.push({ type: 'repaired', amount, integrity: state.integrity })
      state.visit = null
      return
    }
    case 'transfer': {
      if (visit?.kind !== 'stones') return 'There are no sigil stones here'
      const from = inDeck(action.from)
      const to = inDeck(action.to)
      if (!from || !to || from.id === to.id) return 'Choose two different cards from the deck'
      if (!from.sigils.includes(action.sigil)) return 'That card does not have that sigil'
      if (!canGain(to, action.sigil)) return 'That card cannot take this sigil'
      remove(state, from, events)
      addSigil(to, action.sigil, events)
      state.visit = null
      return
    }
    case 'choose': {
      if (visit?.kind !== 'event') return 'There is no event here'
      const option = Number.isInteger(action.option) ? scene(visit.event).options[action.option] : undefined
      if (!option) return 'No such choice'
      for (const effect of option.effects) resolve(state, rng, effect, events)
      const opens = (type: Effect['type']) => option.effects.some((effect) => effect.type === type)
      state.visit =
        opens('lint') && state.deck.some((entry) => entry.sigils.length)
          ? { kind: 'lint', node: visit.node }
          : opens('fuse') && state.deck.some((entry) => duplicated(state, entry))
            ? { kind: 'fuse', node: visit.node }
            : null
      return
    }
    case 'fuse': {
      if (visit?.kind !== 'fuse') return 'There is no merge request here'
      const kept = inDeck(action.card)
      const other =
        kept &&
        state.deck.find(
          (entry) =>
            entry.id !== kept.id && entry.card === kept.card && (action.with === undefined || entry.id === action.with),
        )
      if (!kept || !other) return 'That card has no copy to merge with'
      // Stats add up and sigils join, three at most; the cost stays the card's own.
      kept.attack += other.attack
      kept.health += other.health
      kept.sigils = [...new Set([...kept.sigils, ...other.sigils])].slice(0, MAX_SIGILS)
      kept.added ??= other.added
      state.deck = state.deck.filter((entry) => entry.id !== other.id)
      events.push({ type: 'fused', card: kept, into: other })
      state.visit = null
      return
    }
    case 'pickItem': {
      if (visit?.kind !== 'item') return 'There are no items here'
      const item = Number.isInteger(action.index) ? visit.offer[action.index] : undefined
      if (!item) return 'No such item'
      let dropped: ItemId | undefined
      if (state.items.length >= ITEM_SLOTS) {
        // A full kit gives up one item for the new one.
        dropped = action.drop === undefined ? undefined : state.items[action.drop]
        if (!dropped) return 'Choose an item to give up'
        state.items = state.items.filter((_, index) => index !== action.drop)
      }
      state.items.push(item)
      events.push({ type: 'gotItem', item, ...(dropped ? { dropped } : {}) })
      state.visit = null
      return
    }
    case 'buyItem': {
      const tool = visit?.kind === 'shop' && Number.isInteger(action.index) ? visit.tools[action.index] : undefined
      if (visit?.kind !== 'shop' || !tool) return 'No such tool for sale'
      if (visit.toolsSold.includes(action.index)) return 'That tool is sold'
      if (state.bytes < tool.price) return 'Not enough bytes'
      if (state.items.length >= ITEM_SLOTS) return 'No slot free'
      state.bytes -= tool.price
      visit.toolsSold.push(action.index)
      state.items.push(tool.id)
      events.push({ type: 'gotItem', item: tool.id })
      return
    }
    case 'uninstall': {
      if (visit?.kind !== 'shop') return 'There is no shop here'
      if (visit.uninstalled) return 'Only one uninstall a visit'
      if (state.bytes < UNINSTALL_PRICE) return 'Not enough bytes'
      const target = inDeck(action.card)
      if (!target) return 'That card is not in the deck'
      // A run never loses its last card.
      if (state.deck.length <= 1) return 'The deck needs at least one card'
      state.bytes -= UNINSTALL_PRICE
      visit.uninstalled = true
      state.deck = state.deck.filter((entry) => entry.id !== target.id)
      events.push({ type: 'uninstalled', card: target, price: UNINSTALL_PRICE })
      return
    }
    case 'strip': {
      if (visit?.kind !== 'lint') return 'There is no linter here'
      const target = inDeck(action.card)
      if (!target?.sigils.includes(action.sigil)) return 'That card does not have that sigil'
      target.sigils = target.sigils.filter((sigil) => sigil !== action.sigil)
      // A card whose added sigil is deleted may gain another.
      if (target.added === action.sigil) target.added = null
      events.push({ type: 'stripped', card: target, sigil: action.sigil })
      state.visit = null
      return
    }
    case 'leave': {
      if (['campfire', 'stones', 'lint', 'shop', 'fuse', 'item'].includes(visit?.kind ?? '')) {
        state.visit = null
        return
      }
      if (visit?.kind !== 'battle' || visit.game.status !== 'won') return 'There is nothing to leave'
      // The items not used in the battle come back out of it.
      state.items = [...(visit.game.items ?? [])]
      state.visit =
        findNode(state.map, visit.node)?.kind === 'boss'
          ? { kind: 'reward', offer: rng.shuffle(RARES).slice(0, OFFER_SIZE) }
          : null
      return
    }
  }
  return 'Unknown action'
}

/** Never mutates the given state. */
export function applyRun(current: RunState, action: RunAction): RunResult {
  if (current.status !== 'playing') return fail('The run is over')
  const state = structuredClone(current)
  const rng = new Rng(state.rng)
  const events: RunEvent[] = []
  const refused = step(state, rng, action, events)
  if (refused) return fail(refused)
  state.rng = rng.state
  return { ok: true, state, events }
}

export function legalRunActions(state: RunState): RunAction[] {
  if (state.status !== 'playing') return []
  const visit = state.visit
  if (!visit) return reachable(state).map((node) => ({ type: 'go', node }))

  switch (visit.kind) {
    case 'battle':
      return visit.game.status === 'won'
        ? [{ type: 'leave' }]
        : legalActions(visit.game).map((action) => ({ type: 'play', action }))
    case 'card':
    case 'reward':
    case 'pack':
      return visit.offer.map((_, index) => ({ type: 'take', index }))
    case 'event':
      return scene(visit.event).options.map((_, option) => ({ type: 'choose', option }))
    case 'start':
      return Object.keys(STARTER_DECKS).flatMap((deck): RunAction[] =>
        state.death
          ? [
              { type: 'start', deck },
              { type: 'start', deck, skipDeath: true },
            ]
          : [{ type: 'start', deck }],
      )
    case 'blind':
      return (visit.revealed?.offer ?? visit.picks).map((_, index) => ({ type: 'take', index }))
    case 'shop': {
      const actions: RunAction[] = [{ type: 'leave' }]
      visit.offer.forEach((item, index) => {
        if (!visit.sold.includes(index) && item.price <= state.bytes) actions.push({ type: 'buy', index })
      })
      visit.tools.forEach((tool, index) => {
        if (!visit.toolsSold.includes(index) && state.bytes >= tool.price && state.items.length < ITEM_SLOTS)
          actions.push({ type: 'buyItem', index })
      })
      if (!visit.uninstalled && state.bytes >= UNINSTALL_PRICE && state.deck.length > 1)
        for (const entry of state.deck) actions.push({ type: 'uninstall', card: entry.id })
      return actions
    }
    case 'item': {
      const actions: RunAction[] = [{ type: 'leave' }]
      visit.offer.forEach((_, index) => {
        if (state.items.length < ITEM_SLOTS) actions.push({ type: 'pickItem', index })
        else state.items.forEach((__, drop) => actions.push({ type: 'pickItem', index, drop }))
      })
      return actions
    }
    case 'fuse': {
      const actions: RunAction[] = [{ type: 'leave' }]
      for (const entry of state.deck) if (duplicated(state, entry)) actions.push({ type: 'fuse', card: entry.id })
      return actions
    }
    case 'campfire': {
      const actions: RunAction[] = [{ type: 'leave' }]
      if (visit.buffs === 0 && state.integrity < INTEGRITY) actions.push({ type: 'repair' })
      if (visit.buffs >= MAX_BUFFS || (visit.buffs > 0 && state.deck.length <= 1)) return actions
      for (const entry of state.deck)
        if (visit.card === null || entry.id === visit.card) actions.push({ type: 'buff', card: entry.id })
      return actions
    }
    case 'lint': {
      const actions: RunAction[] = [{ type: 'leave' }]
      for (const entry of state.deck)
        for (const sigil of entry.sigils) actions.push({ type: 'strip', card: entry.id, sigil })
      return actions
    }
    case 'stones': {
      const actions: RunAction[] = [{ type: 'leave' }]
      // Any card may give, a gained sigil included: it is sacrificed, so nothing stacks. Only the taker is limited.
      for (const from of state.deck) {
        for (const sigil of from.sigils)
          for (const to of state.deck)
            if (to.id !== from.id && canGain(to, sigil))
              actions.push({ type: 'transfer', from: from.id, to: to.id, sigil })
      }
      return actions
    }
  }
}

export type RunReplay = { ok: true; state: RunState; events: RunEvent[] } | { ok: false; index: number; reason: string }

/** Any illegal action invalidates the whole record. */
export function replayRun(seed: number, actions: readonly RunAction[], dealt: RunDealt = {}): RunReplay {
  let state = createRun({ seed, ...dealt })
  const events: RunEvent[] = []
  for (const [index, action] of actions.entries()) {
    const result = applyRun(state, action)
    if (!result.ok) return { ok: false, index, reason: result.reason }
    state = result.state
    events.push(...result.events)
  }
  return { ok: true, state, events }
}
