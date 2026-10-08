import {
  applyRun,
  createRun,
  deathCardId,
  deckCard,
  isDeathCard,
  findNode,
  reachable,
  generateStage,
  Rng,
  nextRunAction,
  SCENES,
  scoreRun,
  type ItemId,
  type RunCard,
  type RunDealt,
  type RunState,
  type SigilId,
  type StageMap,
} from 'shared'
import type { RunOver } from '../../lib/api.ts'
import { narrateRun } from './narrate.ts'
import type { Aftermath } from './useRun.ts'
import { MOST_SIGILS, withWorstCard, WORST_CARD } from '../fixtures.ts'

/** A run state to look at, played locally and never saved. */
export type Mockup = { state: RunState; path: string[]; news?: string[]; over?: RunOver; aftermath?: Aftermath }

/** `revision` goes up when the screen changes, so an approval of an older one shows as needing another look. */
type Entry = { title: string; group: 'worst' | 'reached'; revision?: number; make: () => Mockup | null }

// The longest names, the most sigils and the biggest numbers the screens may have to hold.
const LONG_NEWS = [
  'destroyEverything(everyone) gains Technical Debt.',
  'destroyEnemy(you) is 1999 attack, 2000 health now.',
  'Documentation burned. I did warn you.',
]
const WORST_SCENE = 'worst-case'

function worstDeck(size = 40): RunCard[] {
  withWorstCard()
  const ids = [WORST_CARD, 'DestroyEnemyYou', 'Documentation', 'MergeConflict', 'SQLInjection', 'InfiniteLoop']
  return Array.from({ length: size }, (_, index): RunCard => {
    const id = ids[index % ids.length] as string
    const base = deckCard(id)
    // Every third card gave nothing yet and carries three sigils; the rest have room for one more.
    const sigils: SigilId[] = index % 3 === 0 ? [...MOST_SIGILS] : index % 3 === 1 ? MOST_SIGILS.slice(0, 2) : []
    return { ...base, id: index + 1, attack: 1999 - index, health: 2000 - index, sigils, added: null }
  })
}

/** The densest map the generator makes for this stage over many seeds: the most nodes and links it can draw. */
function worstMap(stage: number): StageMap {
  let densest = generateStage(stage, new Rng(0))
  const weight = (map: StageMap) => map.rows.flat().reduce((sum, node) => sum + 1 + node.next.length, 0)
  for (let seed = 1; seed < 400; seed++) {
    const map = generateStage(stage, new Rng(seed))
    if (weight(map) > weight(densest)) densest = map
  }
  return densest
}

/** A worst-case run on the densest map, partway up a real route, with any changes laid over it. */
function worstRun(patch: Partial<RunState>): { state: RunState; path: string[] } {
  const base = createRun({ seed: 1 })
  const map = worstMap(2)
  // Four steps up the first route, so the map shows nodes visited, here, next and ahead.
  const path: string[] = []
  let node = map.rows[0]?.[0]
  while (node && path.length < 4) {
    path.push(node.id)
    node = findNode(map, node.next[0] ?? '')
  }
  const state: RunState = {
    ...base,
    stage: 2,
    map,
    at: path.at(-1) ?? null,
    // Past the starter deck choice, which a fresh run opens on.
    visit: null,
    deck: worstDeck(),
    nextCard: 41,
    record: { battles: 9999, bosses: 3, overkill: 99999 },
    bytes: 99999,
    ...patch,
  }
  return { state, path }
}

function withWorstScene(): string {
  SCENES[WORST_SCENE] ??= {
    id: WORST_SCENE,
    title: 'A merge conflict in a file nobody has opened since the original author left the company',
    text: 'Seven hundred lines of generated code, two incompatible formatters, and a comment that says DO NOT TOUCH in three languages. The build is red, the deploy window closes in four minutes, and P03 is watching the cursor blink with open delight. Somewhere in here is the one line that matters, and somewhere else is a test that only fails on Tuesdays.',
    options: [
      { label: 'Accept every incoming change and hope the tests are wrong', effects: [] },
      { label: 'Accept every current change and blame the other branch in the commit message', effects: [] },
      { label: 'Resolve it by hand, line by line, until the heat death of the universe', effects: [] },
      { label: 'Delete the file', effects: [] },
    ],
  }
  return WORST_SCENE
}

/** A battle in a run carrying these items, its board set so each has something to aim at. */
function itemBattle(
  items: ItemId[],
  rows: { board?: (string | null)[]; front?: (string | null)[]; back?: (string | null)[] },
): { state: RunState; path: string[] } | null {
  const found = reached((s) => s.visit?.kind === 'battle' && s.visit.game.turn > 1 && s.visit.game.drawn)
  if (!found || found.state.visit?.kind !== 'battle') return null
  const game = structuredClone(found.state.visit.game)
  const row = (ids: (string | null)[] = []) =>
    [0, 1, 2, 3].map((lane) => {
      const id = ids[lane]
      if (!id) return null
      game.nextUid += 1
      const card = deckCard(id)
      return { uid: game.nextUid, ...card, maxHealth: card.health }
    })
  game.player.board = row(rows.board)
  game.opponent.front = row(rows.front)
  game.opponent.back = row(rows.back)
  game.summon = null
  game.items = items
  return { ...found, state: { ...found.state, items, visit: { ...found.state.visit, game } } }
}

/** A death card with the longest name, as the profile pin's mockup had it. */
const SAMPLE_DEATH = deathCardId({
  name: 'final_FINAL_v2',
  cost: 1,
  attack: 7,
  health: 3,
  art: 'ForkBomb',
  sigils: ['try_catch'],
})

/** Another player's death card, under the cap. */
const SAMPLE_RIVAL = deathCardId({ name: 'gitBlame', cost: 1, attack: 4, health: 3, art: 'Crawler', sigils: [] })

/** A boss on this stage that has just brought its death card into play. */
const haunted = (state: RunState, stage: number) =>
  state.stage === stage &&
  state.visit?.kind === 'battle' &&
  Boolean(state.visit.game.opponent.haunt?.played) &&
  state.visit.game.status === 'playing'

/** Stops a seeded bot run at the first state that matches, so these follow the rules. */
function reached(stop: (state: RunState) => boolean, dealt: RunDealt = {}): Mockup | null {
  for (let seed = 1; seed <= 120; seed++) {
    let state = createRun({ seed, ...dealt })
    let path: string[] = []
    while (state.status === 'playing' && !stop(state)) {
      const result = applyRun(state, nextRunAction(state))
      if (!result.ok) break
      if (result.state.stage !== state.stage) path = []
      for (const event of result.events) if (event.type === 'entered') path.push(event.node)
      state = result.state
    }
    if (stop(state)) return { state, path }
  }
  return null
}

const isBoss = (state: RunState) =>
  state.visit?.kind === 'battle' && findNode(state.map, state.visit.node)?.kind === 'boss'

export const MOCKUPS: Record<string, Entry> = {
  'worst-map': {
    title: 'The densest map the generator draws',
    group: 'worst',
    make: () => ({ ...worstRun({}), news: LONG_NEWS }),
  },
  'worst-card': {
    title: 'A card choice of the longest card',
    group: 'worst',
    revision: 1,
    make: () => ({
      ...worstRun({ visit: { kind: 'card', node: '4-3', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
      news: LONG_NEWS,
    }),
  },
  'worst-reward': {
    title: "A boss's reward of the longest card",
    group: 'worst',
    revision: 1,
    make: () => ({
      ...worstRun({ visit: { kind: 'reward', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
    }),
  },
  'worst-campfire': {
    title: 'A campfire with a 40-card deck',
    group: 'worst',
    revision: 2,
    make: () => ({
      ...worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'health', card: null, buffs: 0 } }),
      news: LONG_NEWS,
    }),
  },
  'worst-campfire-again': {
    title: 'A campfire after one boost, offering a second',
    group: 'worst',
    revision: 2,
    make: () => ({
      ...worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'attack', card: 1, buffs: 1 } }),
      news: LONG_NEWS,
    }),
  },
  'worst-stones': {
    title: 'Sigil stones with a 40-card deck full of sigils',
    group: 'worst',
    revision: 4,
    make: () => ({ ...worstRun({ visit: { kind: 'stones', node: '4-1' } }), news: LONG_NEWS }),
  },
  'worst-event': {
    title: 'An event with the longest title, text and four choices',
    group: 'worst',
    revision: 1,
    make: () => ({
      ...worstRun({ visit: { kind: 'event', node: '4-1', event: withWorstScene() } }),
      news: LONG_NEWS,
    }),
  },
  'worst-summary': {
    title: 'A cleared run with the biggest numbers and deck',
    group: 'worst',
    revision: 4,
    make: () => ({
      ...worstRun({ status: 'won' }),
      over: { status: 'won', score: 99_999_999, stage: 2, bosses: 3, forfeited: false },
    }),
  },
  'worst-abandoned': {
    title: 'An abandoned run',
    group: 'worst',
    revision: 7,
    make: () => ({
      ...worstRun({ status: 'lost' }),
      over: { status: 'lost', score: 99_999_999, stage: 2, bosses: 3, forfeited: true },
    }),
  },
  map: {
    title: 'The map, partway through a stage',
    group: 'reached',
    make: () => reached((s) => s.at !== null && !s.visit),
  },
  start: {
    title: 'The starter deck choice',
    group: 'reached',
    revision: 4,
    make: () => ({ state: createRun({ seed: 1 }), path: [] }),
  },
  card: { title: 'A card choice', group: 'reached', revision: 1, make: () => reached((s) => s.visit?.kind === 'card') },
  'death-start': {
    title: 'The starter deck choice, with a death card to leave out',
    group: 'reached',
    revision: 8,
    make: () => ({ state: createRun({ seed: 1, death: SAMPLE_DEATH }), path: [] }),
  },
  'death-offer': {
    title: 'The first card choice, offering the death card',
    group: 'reached',
    make: () => reached((s) => s.visit?.kind === 'card' && s.visit.offer.some(isDeathCard), { death: SAMPLE_DEATH }),
  },
  'death-build': {
    title: 'A lost run, building a death card from three hands',
    group: 'reached',
    revision: 9,
    make: () => {
      const found = reached((s) => s.status === 'lost' && s.deck.length >= 5)
      return (
        found && {
          ...found,
          // Straight to the summary, past the lost battle.
          state: { ...found.state, visit: null },
          over: {
            status: 'lost',
            score: scoreRun(found.state.record, false),
            stage: found.state.stage,
            bosses: found.state.record.bosses,
            forfeited: false,
          },
        }
      )
    },
  },
  blind: {
    title: 'A face-down card choice',
    group: 'reached',
    revision: 3,
    make: () => reached((s) => s.visit?.kind === 'blind'),
  },
  'blind-revealed': {
    title: 'A face-down card choice, turned over to three cards',
    group: 'reached',
    revision: 2,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'blind')
      const turned = found && applyRun(found.state, { type: 'take', index: 0 })
      return found && turned?.ok ? { ...found, state: turned.state } : null
    },
  },
  shop: {
    title: 'The Package Registry, with bytes for one card',
    group: 'reached',
    revision: 5,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'shop')
      return found && { ...found, state: { ...found.state, bytes: 7 } }
    },
  },
  campfire: {
    title: 'A campfire',
    group: 'reached',
    revision: 2,
    make: () => reached((s) => s.visit?.kind === 'campfire' && s.deck.length > 4),
  },
  burn: {
    title: 'A campfire after one boost',
    group: 'reached',
    revision: 2,
    make: () => reached((s) => s.visit?.kind === 'campfire' && s.visit.buffs === 1),
  },
  burned: {
    title: 'A card the campfire took, falling, until you leave',
    group: 'reached',
    revision: 6,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'campfire' && s.visit.buffs === 1)
      if (!found || found.state.visit?.kind !== 'campfire') return null
      const card = found.state.deck.find((entry) => entry.id === (found.state.visit as { card: number }).card)
      if (!card) return null
      const deck = found.state.deck.filter((entry) => entry.id !== card.id)
      return {
        ...found,
        state: { ...found.state, deck, visit: null },
        aftermath: {
          kind: 'node',
          view: 'campfire',
          events: [{ type: 'removed', card }],
          lines: narrateRun(found.state, [{ type: 'removed', card }]),
        },
      }
    },
  },
  merged: {
    title: 'A merge request, after two copies become one',
    group: 'reached',
    revision: 2,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event' && s.deck.length >= 2)
      if (!found) return null
      const first = found.state.deck[0] as RunCard
      const copy = { ...first, id: found.state.nextCard }
      const kept = { ...first, attack: first.attack * 2, health: first.health * 2 }
      const events = [{ type: 'fused' as const, card: kept, into: copy }]
      const deck = found.state.deck.map((entry) => (entry.id === first.id ? kept : entry))
      return {
        ...found,
        state: { ...found.state, deck, visit: null },
        aftermath: { kind: 'node', view: 'fuse', events, lines: narrateRun(found.state, events) },
      }
    },
  },
  'stones-done': {
    title: 'Sigil stones, after a sigil has moved',
    group: 'reached',
    revision: 5,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'stones' && s.deck.length >= 2)
      if (!found) return null
      const [from, to] = found.state.deck as [RunCard, RunCard]
      const changed = { ...to, sigils: [...to.sigils, 'retry' as const], added: 'retry' as const }
      const events = [
        { type: 'removed' as const, card: from },
        { type: 'changed' as const, card: changed },
      ]
      const deck = found.state.deck
        .filter((entry) => entry.id !== from.id)
        .map((entry) => (entry.id === to.id ? changed : entry))
      return {
        ...found,
        state: { ...found.state, deck, visit: null },
        aftermath: { kind: 'node', view: 'stones', events, lines: narrateRun(found.state, events) },
      }
    },
  },
  stones: {
    title: 'Sigil stones, given a FourOhFour to sacrifice',
    group: 'reached',
    revision: 4,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'stones')
      if (!found) return null
      // Only FourOhFour has a sigil to give so far, and bots rarely hold it at the stones.
      const { state } = found
      const giver: RunCard = { id: state.nextCard, added: null, ...deckCard('FourOhFour') }
      return { ...found, state: { ...state, nextCard: state.nextCard + 1, deck: [...state.deck, giver] } }
    },
  },
  'stones-empty': {
    title: 'Sigil stones with no sigil to give',
    group: 'reached',
    revision: 4,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'stones')
      if (!found) return null
      // The starter deck carries sigils, so they're taken off to show the stones with nothing to move.
      const deck = found.state.deck.map((entry) => ({ ...entry, sigils: [] }))
      return { ...found, state: { ...found.state, deck } }
    },
  },
  event: {
    title: 'An event',
    group: 'reached',
    revision: 2,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      // A fixed scene, since which one a seed meets changes whenever events are added.
      return { ...found, state: { ...found.state, visit: { ...found.state.visit, event: 'stack-overflow' } } }
    },
  },
  'review-trial': {
    title: 'The code review trial',
    group: 'reached',
    revision: 1,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      return { ...found, state: { ...found.state, visit: { ...found.state.visit, event: 'review-trial' } } }
    },
  },
  fuse: {
    title: 'The merge request, with two copies to merge',
    group: 'reached',
    revision: 3,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      const { state } = found
      const node = found.state.visit.node
      // A second copy of the first card, so there is something to merge.
      const copy = { ...(state.deck[0] as RunCard), id: state.nextCard }
      const deck = [...state.deck, copy]
      return {
        ...found,
        state: { ...state, deck, nextCard: state.nextCard + 1, visit: { kind: 'fuse', node } },
      }
    },
  },
  lint: {
    title: 'The linter, after its event',
    group: 'reached',
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      return { ...found, state: { ...found.state, visit: { kind: 'lint', node: found.state.visit.node } } }
    },
  },
  reward: {
    title: "A boss's reward",
    group: 'reached',
    revision: 1,
    make: () => reached((s) => s.visit?.kind === 'reward'),
  },
  'next-stage': {
    title: 'The map of the second stage',
    group: 'reached',
    make: () => reached((s) => s.stage === 1 && !s.visit && s.at !== null),
  },
  battle: {
    title: 'A battle in a run',
    group: 'reached',
    revision: 1,
    make: () => reached((s) => s.visit?.kind === 'battle' && s.visit.game.turn > 2),
  },
  'battle-items': {
    title: 'A battle in a run, with three items to use',
    group: 'reached',
    make: () => {
      const found = reached((s) => s.visit?.kind === 'battle' && s.visit.game.turn > 2 && s.visit.game.drawn)
      if (!found || found.state.visit?.kind !== 'battle') return null
      const items: ItemId[] = ['hammer', 'pliers', 'hourglass']
      const game = { ...found.state.visit.game, items }
      return { ...found, state: { ...found.state, items, visit: { ...found.state.visit, game } } }
    },
  },
  item: { title: 'A tool rack', group: 'reached', revision: 2, make: () => reached((s) => s.visit?.kind === 'item') },
  'item-full': {
    title: 'A tool rack, with every slot already full',
    group: 'reached',
    revision: 3,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'item')
      const items: ItemId[] = ['hammer', 'hook', 'scissors']
      return found && { ...found, state: { ...found.state, items } }
    },
  },
  'items-own': {
    title: 'Items: the Hammer on your Bug, the Pliers on a sigil, the Hourglass',
    group: 'reached',
    revision: 1,
    make: () =>
      itemBattle(['hammer', 'pliers', 'hourglass'], {
        board: ['Bug', 'CopyPaste'],
        front: [null, null, 'JSONFoorhees', 'NullPointer'],
        back: ['Mainframe'],
      }),
  },
  'items-steal': {
    title: 'Items: the Hook on a Mainframe, the Bottled Boilerplate, the Scissors on the queue',
    group: 'reached',
    revision: 1,
    make: () =>
      itemBattle(['hook', 'bottle', 'scissors'], {
        board: [null, null, 'Watchdog'],
        front: ['Mainframe', 'Firewall'],
        back: [null, null, 'DestroyEnemyYou'],
      }),
  },
  'shop-item': {
    title: 'The Package Registry with its two tools, Scissors among them',
    group: 'reached',
    revision: 5,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'shop')
      if (!found || found.state.visit?.kind !== 'shop') return null
      const visit = {
        ...found.state.visit,
        tools: [
          { id: 'scissors' as ItemId, price: 10 },
          { id: 'hook' as ItemId, price: 6 },
        ],
        toolsSold: [],
      }
      return { ...found, state: { ...found.state, bytes: 14, visit } }
    },
  },
  toolbox: {
    title: 'The toolbox event',
    group: 'reached',
    revision: 2,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      return { ...found, state: { ...found.state, visit: { ...found.state.visit, event: 'toolbox' } } }
    },
  },
  'death-haunt': {
    title: 'The Postmortem bringing back your death card',
    group: 'reached',
    make: () => reached((s) => haunted(s, 2), { death: SAMPLE_DEATH }),
  },
  'rival-haunt': {
    title: "The Staging boss bringing another player's death card",
    group: 'reached',
    make: () => reached((s) => haunted(s, 1), { rival: { card: SAMPLE_RIVAL, by: 'ajimp' } }),
  },
  'card-types': {
    title: 'Card types: Botnet scaling with its Bots, Monolith beside its Legacy',
    group: 'reached',
    make: () =>
      itemBattle([], {
        board: ['Botnet', 'SpamBot', 'Crawler', 'Heisenbug'],
        front: ['Monolith', 'LegacyCode', 'ExploitChain', 'PairProgramming'],
        back: [null, 'Mainframe', null, 'Cookie'],
      }),
  },
  'type-cards': {
    title: 'A card choice of the new type cards',
    group: 'reached',
    revision: 1,
    make: () => {
      const found = reached((s) => s.visit?.kind === 'card')
      if (!found || found.state.visit?.kind !== 'card') return null
      const offer = ['Botnet', 'Monolith', 'PairProgramming']
      return { ...found, state: { ...found.state, visit: { ...found.state.visit, offer } } }
    },
  },
  'boss-next': {
    title: 'The map, one step from the boss',
    group: 'reached',
    make: () =>
      reached((s) => !s.visit && s.at !== null && reachable(s).some((id) => findNode(s.map, id)?.kind === 'boss')),
  },
  'boss-phase': {
    title: "A boss's second phase",
    group: 'reached',
    make: () => reached((s) => isBoss(s) && s.visit?.kind === 'battle' && s.visit.game.opponent.phase === 1),
  },
  'boss-beaten': {
    title: 'A boss just beaten',
    group: 'reached',
    revision: 1,
    make: () => reached((s) => isBoss(s) && s.visit?.kind === 'battle' && s.visit.game.status === 'won'),
  },
  lost: {
    title: 'A run lost in battle',
    group: 'reached',
    revision: 6,
    make: () => reached((s) => s.status === 'lost'),
  },
  won: { title: 'A cleared run', group: 'reached', revision: 3, make: () => reached((s) => s.status === 'won') },
}
