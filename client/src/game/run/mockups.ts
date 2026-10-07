import {
  applyRun,
  createRun,
  deckCard,
  findNode,
  generateStage,
  Rng,
  nextRunAction,
  SCENES,
  type RunCard,
  type RunState,
  type SigilId,
  type StageMap,
} from 'shared'
import type { RunOver } from '../../lib/api.ts'
import { MOST_SIGILS, withWorstCard, WORST_CARD } from '../fixtures.ts'

/** A run state to look at, played locally and never saved. */
export type Mockup = { state: RunState; path: string[]; news?: string[]; over?: RunOver }

type Entry = { title: string; group: 'worst' | 'reached'; make: () => Mockup | null }

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

/** Stops a seeded bot run at the first state that matches, so these follow the rules. */
function reached(stop: (state: RunState) => boolean): Mockup | null {
  for (let seed = 1; seed <= 120; seed++) {
    let state = createRun({ seed })
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
    make: () => ({
      ...worstRun({ visit: { kind: 'card', node: '4-3', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
      news: LONG_NEWS,
    }),
  },
  'worst-reward': {
    title: "A boss's reward of the longest card",
    group: 'worst',
    make: () => ({
      ...worstRun({ visit: { kind: 'reward', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
    }),
  },
  'worst-campfire': {
    title: 'A campfire with a 40-card deck',
    group: 'worst',
    make: () => ({
      ...worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'health', card: null, buffs: 0 } }),
      news: LONG_NEWS,
    }),
  },
  'worst-campfire-again': {
    title: 'A campfire after one boost, offering a second',
    group: 'worst',
    make: () => ({
      ...worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'attack', card: 1, buffs: 1 } }),
      news: LONG_NEWS,
    }),
  },
  'worst-stones': {
    title: 'Sigil stones with a 40-card deck full of sigils',
    group: 'worst',
    make: () => ({ ...worstRun({ visit: { kind: 'stones', node: '4-1' } }), news: LONG_NEWS }),
  },
  'worst-event': {
    title: 'An event with the longest title, text and four choices',
    group: 'worst',
    make: () => ({
      ...worstRun({ visit: { kind: 'event', node: '4-1', event: withWorstScene() } }),
      news: LONG_NEWS,
    }),
  },
  'worst-summary': {
    title: 'A cleared run with the biggest numbers and deck',
    group: 'worst',
    make: () => ({
      ...worstRun({ status: 'won' }),
      over: { status: 'won', score: 99_999_999, stage: 2, bosses: 3, forfeited: false },
    }),
  },
  'worst-abandoned': {
    title: 'An abandoned run',
    group: 'worst',
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
    make: () => ({ state: createRun({ seed: 1 }), path: [] }),
  },
  card: { title: 'A card choice', group: 'reached', make: () => reached((s) => s.visit?.kind === 'card') },
  blind: { title: 'A face-down card choice', group: 'reached', make: () => reached((s) => s.visit?.kind === 'blind') },
  shop: {
    title: 'The Package Registry, with bytes for one card',
    group: 'reached',
    make: () => {
      const found = reached((s) => s.visit?.kind === 'shop')
      return found && { ...found, state: { ...found.state, bytes: 7 } }
    },
  },
  campfire: {
    title: 'A campfire',
    group: 'reached',
    make: () => reached((s) => s.visit?.kind === 'campfire' && s.deck.length > 4),
  },
  burn: {
    title: 'A campfire after one boost',
    group: 'reached',
    make: () => reached((s) => s.visit?.kind === 'campfire' && s.visit.buffs === 1),
  },
  stones: {
    title: 'Sigil stones, given a FourOhFour to sacrifice',
    group: 'reached',
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
    make: () => {
      const found = reached((s) => s.visit?.kind === 'event')
      if (!found || found.state.visit?.kind !== 'event') return null
      // A fixed scene, since which one a seed meets changes whenever events are added.
      return { ...found, state: { ...found.state, visit: { ...found.state.visit, event: 'stack-overflow' } } }
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
  reward: { title: "A boss's reward", group: 'reached', make: () => reached((s) => s.visit?.kind === 'reward') },
  'next-stage': {
    title: 'The map of the second stage',
    group: 'reached',
    make: () => reached((s) => s.stage === 1 && !s.visit && s.at !== null),
  },
  battle: {
    title: 'A battle in a run',
    group: 'reached',
    make: () => reached((s) => s.visit?.kind === 'battle' && s.visit.game.turn > 2),
  },
  'boss-phase': {
    title: "A boss's second phase",
    group: 'reached',
    make: () => reached((s) => isBoss(s) && s.visit?.kind === 'battle' && s.visit.game.opponent.phase === 1),
  },
  'boss-beaten': {
    title: 'A boss just beaten',
    group: 'reached',
    make: () => reached((s) => isBoss(s) && s.visit?.kind === 'battle' && s.visit.game.status === 'won'),
  },
  lost: { title: 'A run lost in battle', group: 'reached', make: () => reached((s) => s.status === 'lost') },
  won: { title: 'A cleared run', group: 'reached', make: () => reached((s) => s.status === 'won') },
}
