import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card } from '../cards.ts'
import { Rng } from '../rng.ts'
import { nextBotAction } from './bot.ts'
import { apply, createGame } from './game.ts'
import { isDeadCode, queue } from './opponent.ts'
import { play, table } from './test-support.ts'
import { LANES, type GameEvent, type GameState } from './types.ts'

const queuedBy = (state: GameState, count: number, turn = 12, seed = 1) => {
  const events: GameEvent[] = []
  const copy = structuredClone(state)
  queue(copy, new Rng(seed), count, turn, events)
  return { state: copy, queued: events.flatMap((event) => (event.type === 'queued' ? [event] : [])) }
}

describe('P03', () => {
  it('deletes a wall of its own that blocks its queue and guards nothing, so the queued card moves up', () => {
    const { state, events } = play(table({ front: [null, null, 'Bug'], back: [null, null, 'GoogleFu'] }), {
      type: 'ringBell',
    })
    assert.ok(events.some((event) => event.type === 'retired' && event.lane === 2))
    assert.equal(state.opponent.front[2]?.card, 'GoogleFu')
    assert.equal(state.player.health, 47, 'and it attacks the turn it arrives')
  })

  it('keeps a wall that is holding back one of the player’s attackers', () => {
    const { state, events } = play(
      table({ board: [null, null, 'GoogleFu'], front: [null, null, 'Bug'], back: [null, null, 'Loop'] }),
      {
        type: 'ringBell',
      },
    )
    assert.ok(!events.some((event) => event.type === 'retired'))
    assert.equal(state.opponent.front[2]?.card, 'Bug')
  })

  it('never queues behind a card that will not move while another lane is open', () => {
    // Lane 0 is walled by a blocker facing an attacker too weak to kill it; lanes 1 to 3 are open.
    for (let seed = 1; seed <= 200; seed++) {
      const state = table({ board: ['HelloWorld'], front: ['Firewall'] })
      const { queued } = queuedBy(state, 3, 12, seed)
      assert.ok(
        queued.every((event) => event.lane !== 0),
        `seed ${seed} queued behind Firewall`,
      )
    }
  })

  it('holds its cards when no lane would open', () => {
    const state = table({
      board: ['HelloWorld', 'HelloWorld', 'HelloWorld', 'HelloWorld'],
      front: ['Firewall', 'Firewall', 'Firewall', 'Firewall'],
    })
    assert.deepEqual(queuedBy(state, 2).queued, [])
  })

  it('only plays a card with no attack as a blocker, never into a lane with nothing to block', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const state = table({ board: [null, 'Bug'] })
      for (const event of queuedBy(state, 2, 12, seed).queued) {
        assert.ok(event.unit.attack > 0, `seed ${seed} queued ${event.unit.card} in lane ${event.lane}`)
      }
    }
  })

  it('usually answers an attacker with a card that kills it or outlasts it', () => {
    let answered = 0
    let total = 0
    for (let seed = 1; seed <= 300; seed++) {
      const state = table({ board: ['NullPointer', 'NullPointer', 'NullPointer', 'NullPointer'] })
      for (const event of queuedBy(state, 1, 12, seed).queued) {
        const def = card(event.unit.card)
        total += 1
        if (def.attack >= 2 || def.health > 4) answered += 1
      }
    }
    assert.ok(answered / total > 0.8, `${answered} of ${total}`)
  })

  it('never lets dead code stop its queue from advancing, over whole games', () => {
    // A wall can become dead code on P03's own turn, by killing what it guarded; it must be gone by the next advance.
    for (let seed = 1; seed <= 300; seed++) {
      let state = createGame({ seed })
      while (state.status === 'playing') {
        const action = nextBotAction(state, seed % 2 ? 'greedy' : 'lanes')
        const dead = [...Array(LANES).keys()].filter((lane) => isDeadCode(state, lane))
        const walls = dead.map((lane) => state.opponent.front[lane]?.uid)
        const result = apply(state, action)
        assert.ok(result.ok)
        if (action.type === 'ringBell' && result.state.status === 'playing') {
          for (const uid of walls) {
            const gone = result.events.some(
              (event) => (event.type === 'retired' || event.type === 'killed') && event.uid === uid,
            )
            assert.ok(gone, `seed ${seed}, turn ${state.turn}: dead code ${uid} survived the bell`)
          }
        }
        state = result.state
      }
    }
  })
})
