import { PLAYER_DECK, card, type SigilId } from '../cards.ts'
import { STAGES } from '../encounters.ts'
import { apply, createGame, legalActions } from '../engine/game.ts'
import { TIP, type DeckCard } from '../engine/types.ts'
import { deckCard } from '../engine/units.ts'
import { Rng } from '../rng.ts'
import { findNode, generateStage } from './map.ts'
import { scene, type Effect } from './scenes.ts'
import type { MapNode, RunAction, RunCard, RunEvent, RunResult, RunState, Visit } from './types.ts'

export const STARTER_DECK = ['Watchdog', 'CronJob', 'SpamBot', 'MergeConflict']
const OFFER_SIZE = 3
const MAX_SIGILS = 3
const MAX_BUFFS = 2
/** The chance that a second buff at the same campfire burns the card. */
const BURN_CHANCE = 0.5

// Tiers A and B are rares, offered only after a boss.
const isRare = (id: string) => ['A', 'B'].includes(card(id).tier)
const COMMONS = PLAYER_DECK.filter((id) => !isRare(id))
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

export function createRun({ seed }: { seed: number }): RunState {
  const rng = new Rng(seed >>> 0)
  const state: RunState = {
    seed: seed >>> 0,
    rng: 0,
    status: 'playing',
    stage: 0,
    map: generateStage(0, rng),
    at: null,
    visit: null,
    deck: [],
    nextCard: 1,
    record: { battles: 0, bosses: 0, overkill: 0 },
  }
  for (const id of STARTER_DECK) state.deck.push(newCard(state, id))
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
        }),
      }
    case 'card':
      return { kind: 'card', node: node.id, offer: rng.shuffle(COMMONS).slice(0, OFFER_SIZE) }
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
  state.record.overkill += Math.max(0, visit.game.scale - TIP)
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
    case 'take': {
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
      state.visit = null
      return
    }
    case 'leave': {
      if (visit?.kind === 'campfire' || visit?.kind === 'stones') {
        state.visit = null
        return
      }
      if (visit?.kind !== 'battle' || visit.game.status !== 'won') return 'There is nothing to leave'
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
    case 'campfire': {
      const actions: RunAction[] = [{ type: 'leave' }]
      if (visit.buffs >= MAX_BUFFS || (visit.buffs > 0 && state.deck.length <= 1)) return actions
      for (const entry of state.deck)
        if (visit.card === null || entry.id === visit.card) actions.push({ type: 'buff', card: entry.id })
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
export function replayRun(seed: number, actions: readonly RunAction[]): RunReplay {
  let state = createRun({ seed })
  const events: RunEvent[] = []
  for (const [index, action] of actions.entries()) {
    const result = applyRun(state, action)
    if (!result.ok) return { ok: false, index, reason: result.reason }
    state = result.state
    events.push(...result.events)
  }
  return { ok: true, state, events }
}
