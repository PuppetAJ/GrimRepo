import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apply, card, createGame, nextBotAction, type Action, type GameEvent, type GameState } from 'shared'
import { DECK, P03_HAND } from './layout.ts'
import { advance, holdsTheTable, start, type Playback } from './playback.ts'

function move(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const result = apply(state, action)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('playback', () => {
  it('sends every card that dies out from where it last stood, and nothing else', () => {
    let deaths = 0
    for (const seed of [5, 6, 7, 8]) {
      let state = createGame({ seed })
      let playback: Playback = start(state)
      while (state.status === 'playing') {
        const { state: after, events } = move(state, nextBotAction(state))
        for (const event of events) {
          const before = playback.leaving.length
          playback = advance(playback, event, 0)
          if (event.type === 'killed') {
            deaths++
            const gone = playback.leaving.at(-1)
            assert.equal(playback.leaving.length, before + 1)
            assert.equal(gone?.unit.uid, event.uid)
            assert.equal(gone?.lane, event.lane)
          }
        }
        state = after
      }
    }
    assert.ok(deaths > 5, `only ${deaths} deaths`)
  })

  it('brings drawn cards from the deck, P03’s from its side, and lunges the attacker', () => {
    // A deal whose hand has a free card that can attack, so it can be played and ring the bell at once.
    const free = (unit: { card: string; attack: number }) => card(unit.card).cost === 0 && unit.attack > 0
    let seed = 1
    while (!createGame({ seed }).player.hand.some(free)) seed++
    const state = createGame({ seed })
    const drawn = move(state, { type: 'draw', from: 'deck' })
    let playback = drawn.events.reduce((current, event) => advance(current, event, 0), start(state))
    const newest = playback.view.hand.at(-1)
    assert.deepEqual(newest && playback.spawns.get(newest.uid), DECK)

    const attacker = playback.view.hand.find(free)
    assert.ok(attacker)
    let current = drawn.state
    for (const action of [
      { type: 'select', uid: attacker.uid },
      { type: 'place', lane: 0 },
      { type: 'ringBell' },
    ] as Action[]) {
      const result = move(current, action)
      for (const event of result.events) playback = advance(playback, event, 1)
      current = result.state
    }
    assert.equal(playback.lunges.get(attacker.uid)?.toward, -1)
    assert.ok([...playback.spawns.values()].some((at) => at === P03_HAND))
  })

  it('holds the table for the bell, not for picking a card', () => {
    const state = createGame({ seed: 2 })
    const drawn = move(state, { type: 'draw', from: 'boilerplate' })
    const fuel = drawn.state.player.hand.find((unit) => unit.card === 'Boilerplate')
    assert.ok(fuel)
    assert.equal(holdsTheTable(move(drawn.state, { type: 'select', uid: fuel.uid }).events), false)
    assert.equal(holdsTheTable(move(drawn.state, { type: 'ringBell' }).events), true)
  })
})
