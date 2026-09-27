import { card, CARDS, PLAYER_DECK, SIGILS, TIP, type GameState, type SigilId, type Unit } from 'shared'

// Fixed states to lay the tables out against, loaded with ?fixture=<name> in development or a test build.
export const FIXTURES_ON = import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1'

const EVERY_SIGIL = Object.keys(SIGILS) as SigilId[]

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

/** Everything at its most: every lane filled, a full hand, every sigil on a card, the longest names and numbers. */
function worst(): GameState {
  uid = 0
  const hand = [
    unit('FourOhFour', { sigils: EVERY_SIGIL }),
    unit('DestroyEnemyYou', { sigils: EVERY_SIGIL }),
    unit('Y2K'),
    unit('Mainframe', { hurt: 9 }),
    unit('Documentation', { sigils: ['technical_debt', 'try_catch', 'rate_limiter'] }),
    unit('JSONFoorhees'),
    unit('RubberDuck', { sigils: EVERY_SIGIL }),
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
      deck: [...PLAYER_DECK, ...PLAYER_DECK].slice(0, 42),
      hand,
      board: [
        unit('Mainframe', { sigils: EVERY_SIGIL, hurt: 10 }),
        unit('DestroyEnemyYou', { sigils: ['fork', 'bypass'] }),
        unit('Documentation', { sigils: EVERY_SIGIL }),
        unit('Y2K', { hurt: 1999 }),
      ],
    },
    opponent: {
      front: [
        unit('DestroyEnemyYou', { sigils: EVERY_SIGIL }),
        unit('JSONFoorhees', { hurt: 7 }),
        unit('Documentation'),
        unit('RubberDuck', { sigils: ['hotfix', 'rate_limiter'] }),
      ],
      back: [unit('ForkBomb'), unit('Mainframe', { sigils: EVERY_SIGIL }), unit('Sandbox'), unit('Bug')],
    },
    // Halfway through summoning the dearest card, so the prompt, the marks and a lifted card all show.
    summon: { uid: hand[0]!.uid, marked: [1] },
    nextUid: 100,
  }
}

const FIXTURES: Record<string, () => GameState> = { worst }

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

/** A card as hard to lay out as any can be: the longest name, the top cost, huge numbers and every sigil. */
export const WORST_CARD = 'WorstCase'

/** Puts the worst-case card in the card table, in development and test builds only, for the compendium to show. */
export function withWorstCard(): boolean {
  if (!FIXTURES_ON) return false
  CARDS[WORST_CARD] ??= {
    id: WORST_CARD,
    name: 'destroyEverything(everyone)',
    tier: 'A',
    attack: 2000,
    health: 2000,
    cost: 4,
    sigils: EVERY_SIGIL,
  }
  return true
}
