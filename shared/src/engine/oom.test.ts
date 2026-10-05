import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OUT_OF_MEMORY } from '../cards.ts'
import { apply, createGame } from './game.ts'
import type { GameEvent, GameState } from './types.ts'
import { deckCard } from './units.ts'

const deck = ['Watchdog', 'CronJob', 'SpamBot', 'Bug'].map(deckCard)

/** Empties the deck, hand and P03's queue, as late in a battle, then draws so the deck is rebuilt. */
function rebuild(state: GameState): { state: GameState; events: GameEvent[] } {
  const ready = structuredClone(state)
  Object.assign(ready, { drawn: false, summon: null })
  ready.player.deck = []
  ready.player.hand = []
  ready.opponent.back.fill(null)
  const result = apply(ready, { type: 'draw', from: 'deck' })
  if (!result.ok) throw new Error(result.reason)
  return result
}

const oomIn = (events: GameEvent[]) =>
  events.flatMap((event) => (event.type === 'queued' && event.unit.card === OUT_OF_MEMORY ? [event.unit] : []))

describe('Out of Memory', () => {
  it('lets a run battle rebuild its deck once for free, then charges a bigger card each time', () => {
    let state = createGame({ seed: 7, deck, outOfMemory: true })
    const sizes: number[] = []
    const bypassing: boolean[] = []
    for (let time = 1; time <= 6; time++) {
      const result = rebuild(state)
      assert.ok(result.events.some((event) => event.type === 'reshuffled'))
      const queued = oomIn(result.events)
      if (time === 1) assert.equal(queued.length, 0, 'the first rebuild is free')
      for (const unit of queued) {
        assert.equal(unit.attack, unit.health)
        sizes.push(unit.attack)
        bypassing.push(unit.sigils.includes('bypass'))
      }
      state = result.state
    }
    assert.deepEqual(sizes, [1, 2, 3, 4, 5])
    assert.deepEqual(bypassing, [false, false, false, false, true], 'Bypass from the fifth')
  })

  it('leaves a quick battle rebuilding its deck as before, for nothing', () => {
    let state = createGame({ seed: 7, deck })
    for (let time = 1; time <= 3; time++) {
      const result = rebuild(state)
      assert.equal(oomIn(result.events).length, 0)
      state = result.state
    }
    assert.equal(state.rebuilds, undefined)
  })
})
