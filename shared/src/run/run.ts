import { PLAYER_DECK, card, parseDeathCard, type SigilId } from '../cards.ts'
import { STAGES } from '../encounters.ts'
import { apply, createGame, legalActions } from '../engine/game.ts'
import { MAX_SIGILS, TIP, type DeckCard } from '../engine/types.ts'
import { deckCard } from '../engine/units.ts'
import { Rng } from '../rng.ts'
import { findNode, generateStage } from './map.ts'
import { scene, type Effect } from './scenes.ts'
import { FOUND_ITEMS, ITEM_SLOTS, type ItemId } from '../items.ts'
import type { MapNode, Pick, RunAction, RunCard, RunEvent, RunResult, RunState, Trial, Visit } from './types.ts'

/** The decks a run can start with, chosen as its first action. */
export const STARTER_DECKS: Record<string, { name: string; about: string; cards: string[] }> = {
  'hello-world': {
    name: 'Hello, World',
    about: 'Steady: hits every empty lane, survives its sacrifice, and guards.',
    cards: ['HelloWorld', 'CronJob', 'MergeConflict'],
  },
  'legacy-stack': {
    name: 'Legacy Stack',
    about: 'Sacrifices: Refactor and Technical Debt pay for big cards early.',
    cards: ['CronJob', 'OffCenterDiv', 'LegacyCode', 'SpamBot'],
  },
  'move-fast': {
    name: 'Move Fast',
    about: 'Three cards and little health: hit hard, and hope.',
    cards: ['CopyPaste', 'SpamBot', 'CronJob'],
  },
}

/** What a card costs at a shop, in bytes, by tier. */
const PRICE: Record<string, number> = { E: 3, D: 5, C: 6, B: 12, A: 15 }

/** How often a shop has an item for sale. */
const SHOP_ITEM_SHARE = 0.3

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

// Tiers A and B are rares, offered only after a boss.
const isRare = (id: string) => ['A', 'B'].includes(card(id).tier)
export const COMMONS = PLAYER_DECK.filter((id) => !isRare(id))
const RARES = PLAYER_DECK.filter(isRare)

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

/** `death` is the player's death card id, if they have one; a malformed one is ignored. */
export function createRun({ seed, death = null }: { seed: number; death?: string | null }): RunState {
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
    death: death && parseDeathCard(death) ? { card: death, skipped: false, offered: false } : null,
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
        const offer = [state.death.card, ...rng.shuffle(COMMONS).slice(0, OFFER_SIZE - 1)]
        return { kind: 'card', node: node.id, offer: rng.shuffle(offer) }
      }
      return { kind: 'card', node: node.id, offer: rng.shuffle(COMMONS).slice(0, OFFER_SIZE) }
    case 'shop': {
      // Two commons and a rare, priced by tier.
      const cards = [...rng.shuffle(COMMONS).slice(0, 2), ...rng.shuffle(RARES).slice(0, 1)]
      const offer = cards.map((id) => ({ card: id, price: PRICE[card(id).tier] ?? 10 }))
      // Now and then a tool too; Scissors are found nowhere else.
      const tool = rng.float() < SHOP_ITEM_SHARE ? rng.pick<ItemId>(['scissors', ...FOUND_ITEMS]) : null
      const item = tool ? { id: tool, price: tool === 'scissors' ? 10 : 6 } : undefined
      return { kind: 'shop', node: node.id, offer, sold: [], ...(item ? { item } : {}) }
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

function remove(state: RunState, target: RunCard, events: RunEvent[]): void {
  state.deck = state.deck.filter((entry) => entry.id !== target.id)
  events.push({ type: 'removed', card: target })
}

const canGain = (target: RunCard, sigil: SigilId): boolean =>
  !target.added && !target.sigils.includes(sigil) && target.sigils.length < MAX_SIGILS

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

function end(state: RunState, outcome: 'win' | 'loss', events: RunEvent[]): void {
  state.status = outcome === 'win' ? 'won' : 'lost'
  events.push({ type: 'runOver', outcome })
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
      events.push({ type: 'battle', events: result.events })
      if (result.state.status === 'lost') end(state, 'loss', events)
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
      for (const id of deck.cards) state.deck.push(newCard(state, id))
      state.visit = null
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
      if (visit?.kind === 'blind') {
        const pick = Number.isInteger(action.index) ? visit.picks[action.index] : undefined
        if (!pick) return 'No such choice'
        const added = newCard(state, rng.pick(COMMONS.filter(PICKS[pick].fits)))
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
    case 'transfer': {
      if (visit?.kind !== 'stones') return 'There are no sigil stones here'
      const from = inDeck(action.from)
      const to = inDeck(action.to)
      if (!from || !to || from.id === to.id) return 'Choose two different cards from the deck'
      if (from.added) return 'A card that already gained a sigil cannot give one'
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
      const other = kept && state.deck.find((entry) => entry.id !== kept.id && entry.card === kept.card)
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
      if (visit?.kind !== 'shop' || !visit.item) return 'No item for sale here'
      if (visit.itemSold) return 'That item is sold'
      if (state.bytes < visit.item.price) return 'Not enough bytes'
      if (state.items.length >= ITEM_SLOTS) return 'No slot free'
      state.bytes -= visit.item.price
      visit.itemSold = true
      state.items.push(visit.item.id)
      events.push({ type: 'gotItem', item: visit.item.id })
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
      return visit.picks.map((_, index) => ({ type: 'take', index }))
    case 'shop': {
      const actions: RunAction[] = [{ type: 'leave' }]
      visit.offer.forEach((item, index) => {
        if (!visit.sold.includes(index) && item.price <= state.bytes) actions.push({ type: 'buy', index })
      })
      if (visit.item && !visit.itemSold && state.bytes >= visit.item.price && state.items.length < ITEM_SLOTS)
        actions.push({ type: 'buyItem' })
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
      for (const from of state.deck) {
        if (from.added) continue
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
export function replayRun(seed: number, actions: readonly RunAction[], death: string | null = null): RunReplay {
  let state = createRun({ seed, death })
  const events: RunEvent[] = []
  for (const [index, action] of actions.entries()) {
    const result = applyRun(state, action)
    if (!result.ok) return { ok: false, index, reason: result.reason }
    state = result.state
    events.push(...result.events)
  }
  return { ok: true, state, events }
}
