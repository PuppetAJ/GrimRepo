import {
  applyRun,
  createRun,
  deckCard,
  findNode,
  nextRunAction,
  SCENES,
  type MapNode,
  type NodeKind,
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

function worstMap(stage: number): StageMap {
  const kinds: NodeKind[] = ['campfire', 'stones', 'card']
  const rows: MapNode[][] = Array.from({ length: 7 }, (_, row) =>
    kinds.map((kind, col) => ({ id: `${row}-${col}`, kind, row, col, next: [], boost: 'health' as const })),
  )
  const boss = ['localhost-boss', 'staging-boss', 'production-boss'][stage] as string
  rows.push([{ id: '7-0', kind: 'boss', row: 7, col: 0, next: [], encounter: boss }])
  // Every node leads to each neighbor ahead, the most links a row can have.
  for (const [index, row] of rows.entries())
    for (const node of row)
      node.next = (rows[index + 1] ?? [])
        .filter((ahead) => Math.abs(ahead.col - node.col) <= 1 || ahead.kind === 'boss')
        .map((ahead) => ahead.id)
  return { stage, rows }
}

function worstRun(patch: Partial<RunState>): RunState {
  const base = createRun({ seed: 1 })
  return {
    ...base,
    stage: 2,
    map: worstMap(2),
    at: '3-1',
    deck: worstDeck(),
    nextCard: 41,
    record: { battles: 9999, bosses: 3, overkill: 99999 },
    ...patch,
  }
}

const WORST_PATH = ['0-0', '1-1', '2-1', '3-1']

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
    title: 'The map, three nodes in every row and every link',
    group: 'worst',
    make: () => ({ state: worstRun({}), path: WORST_PATH, news: LONG_NEWS }),
  },
  'worst-card': {
    title: 'A card choice of the longest card',
    group: 'worst',
    make: () => ({
      state: worstRun({ visit: { kind: 'card', node: '4-2', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
      path: WORST_PATH,
      news: LONG_NEWS,
    }),
  },
  'worst-reward': {
    title: "A boss's reward of the longest card",
    group: 'worst',
    make: () => ({
      state: worstRun({ visit: { kind: 'reward', offer: [WORST_CARD, WORST_CARD, WORST_CARD] } }),
      path: WORST_PATH,
    }),
  },
  'worst-campfire': {
    title: 'A campfire with a 40-card deck',
    group: 'worst',
    make: () => ({
      state: worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'health', card: null, buffs: 0 } }),
      path: WORST_PATH,
      news: LONG_NEWS,
    }),
  },
  'worst-campfire-again': {
    title: 'A campfire after one boost, offering a second',
    group: 'worst',
    make: () => ({
      state: worstRun({ visit: { kind: 'campfire', node: '4-0', boost: 'attack', card: 1, buffs: 1 } }),
      path: WORST_PATH,
      news: LONG_NEWS,
    }),
  },
  'worst-stones': {
    title: 'Sigil stones with a 40-card deck full of sigils',
    group: 'worst',
    make: () => ({ state: worstRun({ visit: { kind: 'stones', node: '4-1' } }), path: WORST_PATH, news: LONG_NEWS }),
  },
  'worst-event': {
    title: 'An event with the longest title, text and four choices',
    group: 'worst',
    make: () => ({
      state: worstRun({ visit: { kind: 'event', node: '4-1', event: withWorstScene() } }),
      path: WORST_PATH,
      news: LONG_NEWS,
    }),
  },
  'worst-summary': {
    title: 'A cleared run with the biggest numbers and deck',
    group: 'worst',
    make: () => ({
      state: worstRun({ status: 'won' }),
      path: WORST_PATH,
      over: { status: 'won', score: 99_999_999, stage: 2, bosses: 3, forfeited: false },
    }),
  },
  'worst-abandoned': {
    title: 'An abandoned run',
    group: 'worst',
    make: () => ({
      state: worstRun({ status: 'lost' }),
      path: WORST_PATH,
      over: { status: 'lost', score: 99_999_999, stage: 2, bosses: 3, forfeited: true },
    }),
  },
  map: {
    title: 'The map, partway through a stage',
    group: 'reached',
    make: () => reached((s) => s.at !== null && !s.visit),
  },
  card: { title: 'A card choice', group: 'reached', make: () => reached((s) => s.visit?.kind === 'card') },
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
  event: { title: 'An event', group: 'reached', make: () => reached((s) => s.visit?.kind === 'event') },
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
