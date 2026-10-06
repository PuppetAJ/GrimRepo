import { card, CARDS, deckCard, PLAYER_DECK, SIGILS, TIP, type GameState, type SigilId, type Unit } from 'shared'

// Fixed states for checking layouts, loaded with ?fixture=<name> in dev and test builds.
export const FIXTURES_ON = import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1'

// The three sigils with the longest text, since a card carries three at most.
export const MOST_SIGILS = (Object.keys(SIGILS) as SigilId[])
  .sort((a, b) => SIGILS[b].text.length - SIGILS[a].text.length)
  .slice(0, 3)

let uid = 0
const unit = (id: string, { sigils, hurt = 0 }: { sigils?: SigilId[]; hurt?: number } = {}): Unit => {
  const def = card(id)
  uid += 1
  return {
    uid,
    card: id,
    attack: def.attack,
    health: def.health - hurt,
    maxHealth: def.health,
    sigils: sigils ?? def.sigils,
  }
}

function worst(): GameState {
  uid = 0
  const hand = [
    unit('FourOhFour', { sigils: MOST_SIGILS }),
    unit('DestroyEnemyYou', { sigils: MOST_SIGILS }),
    unit('Y2K'),
    unit('Mainframe', { hurt: 9 }),
    unit('Documentation', { sigils: ['technical_debt', 'try_catch', 'rate_limiter'] }),
    unit('JSONFoorhees'),
    unit('RubberDuck', { sigils: MOST_SIGILS }),
  ]
  return {
    seed: 1,
    rng: 1,
    turn: 99,
    drawn: true,
    status: 'playing',
    debug: false,
    scale: -(TIP - 1),
    player: {
      library: [...PLAYER_DECK, ...PLAYER_DECK].slice(0, 42).map(deckCard),
      deck: [...Array(42).keys()],
      hand,
      board: [
        unit('Mainframe', { sigils: MOST_SIGILS, hurt: 10 }),
        unit('DestroyEnemyYou', { sigils: ['fork', 'bypass'] }),
        unit('Documentation', { sigils: MOST_SIGILS }),
        unit('Y2K', { hurt: 1999 }),
      ],
    },
    opponent: {
      front: [
        unit('DestroyEnemyYou', { sigils: MOST_SIGILS }),
        unit('JSONFoorhees', { hurt: 7 }),
        unit('Documentation'),
        unit('RubberDuck', { sigils: ['hotfix', 'rate_limiter'] }),
      ],
      back: [unit('ForkBomb'), unit('Mainframe', { sigils: MOST_SIGILS }), unit('Sandbox'), unit('Bug')],
      encounter: null,
      phase: 0,
      step: 0,
    },
    // Mid-summon, so the prompt, the marks and a lifted card all show.
    summon: { uid: hand[0]!.uid, marked: [1] },
    nextUid: 100,
  }
}

// Attack changed by the cards around it: Tech Lead beside, and Pop-up and Packet Loss opposite.
function auras(): GameState {
  uid = 0
  const state = worst()
  uid = 200
  return {
    ...state,
    turn: 3,
    scale: 0,
    summon: null,
    player: {
      ...state.player,
      hand: [unit('CopyPaste'), unit('Watchdog')],
      board: [unit('CopyPaste'), unit('GrimRepo'), unit('CopyPaste'), unit('SpamBot')],
    },
    opponent: {
      ...state.opponent,
      front: [unit('Cookie'), null, null, unit('CopyPaste')],
      back: [null, unit('Bug'), null, null],
    },
    nextUid: 300,
  }
}

const FIXTURES: Record<string, () => GameState> = { worst, auras }

export function fixture(): { name: string; state: GameState; log: string[] } | null {
  if (!FIXTURES_ON) return null
  const name = new URLSearchParams(window.location.search).get('fixture')
  const make = name ? FIXTURES[name] : undefined
  if (!name || !make) return null
  const log = [...Array(40).keys()].map(
    (i) =>
      `P03> ${i % 3 ? 'destroyEnemy(you) hit JSONFoorhees in lane 2 for 8, and it was destroyed.' : `Turn ${60 + i}. Draw.`}`,
  )
  return { name, state: make(), log: [`P03> Fixture "${name}": played here and never saved.`, ...log] }
}

export const WORST_CARD = 'WorstCase'

/** Adds the worst-case card to CARDS in dev and test builds, for the compendium. */
export function withWorstCard(): boolean {
  if (!FIXTURES_ON) return false
  CARDS[WORST_CARD] ??= {
    id: WORST_CARD,
    name: 'destroyEverything(everyone)',
    tier: 'A',
    attack: 2000,
    health: 2000,
    cost: 4,
    // The three with the longest descriptions.
    sigils: ['segfault', 'fork', 'bypass'],
  }
  return true
}
