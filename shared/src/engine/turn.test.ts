import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CARDS } from '../cards.ts'
import { apply, createGame, legalActions } from './game.ts'
import { maxCostFor } from './opponent.ts'
import { play, refused, table } from './test-support.ts'
import { TIP, TURN_LIMIT } from './types.ts'

describe('a turn', () => {
  it('runs the player’s attacks before the opponent’s', () => {
    const { events } = play(table({ board: ['GoogleFu'], front: [null, 'GoogleFu'] }), { type: 'ringBell' })
    const sides = events
      .filter((event) => event.type === 'attacked')
      .map((event) => event.type === 'attacked' && event.side)
    assert.deepEqual(sides, ['player', 'opponent'])
  })

  it('ends in a win the moment the scale tips to the player, before P03 can strike back', () => {
    const state = table({ board: ['GoogleFu'], front: [null, 'JACK'], scale: TIP - 3 })
    const { state: after, events } = play(state, { type: 'ringBell' })
    assert.equal(after.status, 'won')
    assert.ok(!events.some((event) => event.type === 'attacked' && event.side === 'opponent'))
    assert.deepEqual(events.at(-1), { type: 'gameOver', outcome: 'win', turns: 1 })
  })

  it('ends in a loss when P03’s attacks tip the scale its way', () => {
    const { state } = play(table({ front: ['JACK'], scale: 10 - TIP }), { type: 'ringBell' })
    assert.equal(state.status, 'lost')
    assert.equal(state.scale, -TIP - 3, 'the overshoot is kept')
  })

  it('stops a card killed by the player from attacking that turn', () => {
    const { state } = play(table({ board: ['GitSome'], front: ['GoogleFu'] }), { type: 'ringBell' })
    assert.equal(state.scale, 0)
  })

  it('moves queued cards up into empty lanes, and they attack straight away', () => {
    const { state, events } = play(table({ back: ['GoogleFu', 'Loop'], front: [null, 'GrimRepo'] }), {
      type: 'ringBell',
    })
    assert.equal(state.opponent.front[0]?.card, 'GoogleFu')
    assert.equal(state.opponent.front[1]?.card, 'GrimRepo', 'a card that can attack still blocks its queue')
    assert.equal(state.opponent.back[1]?.card, 'Loop')
    assert.ok(events.some((event) => event.type === 'advanced' && event.lane === 0))
    assert.equal(state.scale, -6, 'the new arrival and the blocker both hit an empty lane')
  })

  it('queues new cards only into empty back lanes, and only cheap ones early on', () => {
    for (let seed = 0; seed < 100; seed++) {
      const start = createGame({ seed })
      start.drawn = true
      const occupied = start.opponent.back.map((slot) => slot?.uid ?? null)
      const { events } = play(start, { type: 'ringBell' })
      for (const event of events) {
        if (event.type !== 'queued') continue
        assert.equal(CARDS[event.unit.card]?.cost, 0, `seed ${seed} queued ${event.unit.card} on turn 1`)
        const advancedAway = events.some((e) => e.type === 'advanced' && e.lane === event.lane)
        assert.ok(occupied[event.lane] === null || advancedAway, `seed ${seed} queued over a waiting card`)
      }
    }
    assert.deepEqual([0, 2, 3, 5, 6, 9, 10, 50].map(maxCostFor), [0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('starts the next turn with a fresh draw', () => {
    const { state } = play(table({}), { type: 'ringBell' })
    assert.equal(state.turn, 2)
    assert.equal(refused(state, { type: 'ringBell' }), 'Draw first')
  })

  it('is lost if it drags on to the turn limit', () => {
    const state = table({ board: ['Bug'] })
    state.turn = TURN_LIMIT
    const { state: after, events } = play(state, { type: 'ringBell' })
    assert.equal(after.status, 'lost')
    assert.deepEqual(events.at(-1), { type: 'gameOver', outcome: 'loss', turns: TURN_LIMIT })
  })

  it('accepts nothing once the game is over', () => {
    const { state } = play(table({ front: ['JACK'], scale: 1 - TIP }), { type: 'ringBell' })
    assert.deepEqual(legalActions(state), [])
    assert.equal(refused(state, { type: 'ringBell' }), 'The game is over')
  })

  it('never changes the state it was given', () => {
    const state = table({ board: ['JACK'], front: ['Loop'], back: ['Bug'] })
    const before = structuredClone(state)
    assert.ok(apply(state, { type: 'ringBell' }).ok)
    assert.deepEqual(state, before)
  })
})
