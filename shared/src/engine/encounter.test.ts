import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card } from '../cards.ts'
import { cardsIn, ENCOUNTERS, STAGES } from '../encounters.ts'
import { createGame, legalActions } from './game.ts'
import { play } from './test-support.ts'
import { LANES, TIP, type DeckCard } from './types.ts'
import { deckCard, drawUnit, units } from './units.ts'

const queued = (state: ReturnType<typeof createGame>) => units(state.opponent.back).map((unit) => unit.card)

describe('the encounter data', () => {
  it('names only real cards and lanes', () => {
    for (const found of Object.values(ENCOUNTERS)) {
      assert.doesNotThrow(() => cardsIn(found), found.id)
      for (const turn of found.phases.flat())
        for (const entry of turn) assert.ok(entry.lane >= 0 && entry.lane < LANES, `${found.id} lane ${entry.lane}`)
    }
  })

  it('gives every stage battles and one boss with two phases', () => {
    for (const [stage] of STAGES.entries()) {
      const here = Object.values(ENCOUNTERS).filter((found) => found.stage === stage)
      assert.ok(here.filter((found) => !found.boss).length >= 2, `stage ${stage} battles`)
      const bosses = here.filter((found) => found.boss)
      assert.equal(bosses.length, 1)
      assert.equal(bosses[0]?.phases.length, 2)
    }
  })
})

describe('a battle with an encounter', () => {
  it('queues the plan’s first turn before the first draw', () => {
    const state = createGame({ seed: 3, encounter: 'localhost-cron' })
    assert.deepEqual(queued(state), ['CronJob'])
    assert.equal(state.opponent.back[0]?.card, 'CronJob')
  })

  it('follows the plan turn by turn, then falls back to P03’s usual picks', () => {
    let state = createGame({ seed: 3, encounter: 'localhost-cron' })
    const turns: string[][] = []
    for (let turn = 1; turn <= 4; turn++) {
      const draw = legalActions(state).some((action) => action.type === 'draw')
      const moves = draw ? [{ type: 'draw', from: 'boilerplate' } as const] : []
      const { state: next, events } = play(state, ...moves, { type: 'ringBell' })
      turns.push(events.flatMap((event) => (event.type === 'queued' ? [event.unit.card] : [])))
      // Levelled each turn, so P03's unanswered hits don't end the game before the plan runs out.
      state = { ...next, scale: 0 }
    }
    assert.deepEqual(turns[0], ['GrimRepo', 'SpamBot'])
    assert.ok(['GrimRepo', 'CopyPaste'].includes(turns[1]?.[0] as string) && turns[1]?.length === 1)
    assert.deepEqual(turns[2], ['ZeroDay'])
    assert.deepEqual(turns[3], ['Watchdog'])
    assert.equal(state.opponent.step, 5, 'the next turn is past the plan')
  })

  it('picks from a pool where the plan gives one', () => {
    const picked = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const state = play(
        createGame({ seed, encounter: 'localhost-hello' }),
        { type: 'draw', from: 'boilerplate' },
        {
          type: 'ringBell',
        },
      ).state
      for (const unit of units(state.opponent.back)) picked.add(unit.card)
    }
    assert.ok(picked.has('CronJob') && picked.has('SpamBot'), [...picked].join(', '))
  })
})

describe('a boss', () => {
  const tipped = (phase: number) => {
    const state = createGame({ seed: 11, encounter: 'localhost-boss' })
    state.drawn = true
    state.opponent.phase = phase
    state.scale = TIP - 1
    state.opponent.front.fill(null)
    state.player.board[0] = drawUnit(state, 0)
    ;(state.player.board[0] as NonNullable<(typeof state.player.board)[0]>).attack = 5
    return play(state, { type: 'ringBell' })
  }

  it('levels the scale and clears its side when its first phase tips', () => {
    const { state, events } = tipped(0)
    assert.equal(state.status, 'playing')
    assert.equal(state.opponent.phase, 1)
    assert.equal(state.scale, 0)
    assert.ok(events.some((event) => event.type === 'phaseChanged'))
    assert.deepEqual(queued(state).sort(), ['Bug', 'Bug'])
    assert.equal(units(state.opponent.front).length, 0)
  })

  it('is beaten when its last phase tips', () => {
    const { state } = tipped(1)
    assert.equal(state.status, 'won')
  })
})

describe('a run’s deck', () => {
  const deck: DeckCard[] = [
    { ...deckCard('CronJob'), attack: 4, health: 9, sigils: ['bypass'] },
    deckCard('CronJob'),
    deckCard('Firewall'),
    deckCard('Bug'),
  ]

  it('deals its cards with their changed stats', () => {
    const state = createGame({ seed: 1, deck })
    const all = [...state.player.hand, ...state.player.deck.map((source) => drawUnit(state, source))]
    const buffed = all.find((unit) => unit.attack === 4)
    assert.ok(buffed && buffed.card === 'CronJob' && buffed.maxHealth === 9 && buffed.sigils.includes('bypass'))
    assert.equal(state.player.library.length, 4)
  })

  it('rebuilds an empty deck without a copy that is in play, but with its twin', () => {
    const state = createGame({ seed: 1, deck })
    const inHand = state.player.hand.find((unit) => unit.source !== undefined)
    assert.ok(inHand)
    state.player.deck = []
    state.drawn = false
    const { state: after } = play(state, { type: 'draw', from: 'deck' })
    const rebuilt = [...after.player.deck, after.player.hand.at(-1)?.source]
    assert.ok(!rebuilt.includes(inHand.source))
    assert.equal(new Set(rebuilt).size, rebuilt.length)
  })

  it('offers no deck draw when every card is already in play', () => {
    const state = createGame({ seed: 1, deck: deck.slice(0, 3) })
    assert.equal(state.player.deck.length, 0)
    const draws = legalActions(state).filter((action) => action.type === 'draw')
    assert.deepEqual(draws, [{ type: 'draw', from: 'boilerplate' }])
  })

  it('opens with a card costing 1 or less when asked for a fair hand', () => {
    const heavy: DeckCard[] = ['ForkBomb', 'Documentation', 'JSONFoorhees', 'DestroyEnemyYou', 'CronJob'].map(deckCard)
    for (let seed = 0; seed < 50; seed++) {
      const state = createGame({ seed, deck: heavy, fairHand: true })
      assert.ok(
        state.player.hand.some((unit) => unit.source !== undefined && card(unit.card).cost <= 1),
        `seed ${seed}`,
      )
    }
  })
})
