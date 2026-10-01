import { applyRun, createRun, deckCard, nextRunAction, type RunState } from 'shared'
import { FIXTURES_ON } from '../fixtures.ts'

// Each stops a bot's seeded run at the first state that matches, so the fixtures follow the rules.
const STOPS: Record<string, (state: RunState) => boolean> = {
  map: (state) => state.at !== null && !state.visit && state.status === 'playing',
  battle: (state) => state.visit?.kind === 'battle' && state.visit.game.turn > 2,
  card: (state) => state.visit?.kind === 'card',
  campfire: (state) => state.visit?.kind === 'campfire' && state.deck.length > 4,
  burn: (state) => state.visit?.kind === 'campfire' && state.visit.buffs === 1,
  stones: (state) => state.visit?.kind === 'stones',
  event: (state) => state.visit?.kind === 'event',
  reward: (state) => state.visit?.kind === 'reward',
  stage: (state) => state.stage === 1 && !state.visit && state.at !== null,
  lost: (state) => state.status === 'lost',
  won: (state) => state.status === 'won',
}

const SEEDS = 120

type Found = { state: RunState; path: string[] }

function find(stop: (state: RunState) => boolean): Found | null {
  for (let seed = 1; seed <= SEEDS; seed++) {
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

// Only FourOhFour has a sigil to give so far, and bots rarely hold it at the stones.
function withGiver(found: Found): Found {
  const { state } = found
  const giver = { id: state.nextCard, added: null, ...deckCard('FourOhFour') }
  return { ...found, state: { ...state, nextCard: state.nextCard + 1, deck: [...state.deck, giver] } }
}

/** A run state loaded with ?fixture=run-<name> in dev and test builds, for checking each screen. */
export function runFixture(): ({ name: string } & Found) | null {
  if (!FIXTURES_ON) return null
  const name = new URLSearchParams(window.location.search).get('fixture')?.replace(/^run-/, '')
  const stop = name ? STOPS[name] : undefined
  const found = stop ? find(stop) : null
  return name && found ? { name, ...(name === 'stones' ? withGiver(found) : found) } : null
}
