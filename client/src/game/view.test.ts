import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apply, createGame, nextBotAction, type Strategy } from 'shared'
import { locate, project, step } from './view.ts'

describe('the table view', () => {
  it('lands exactly on the real state after every move of whole games', () => {
    let moves = 0
    for (const strategy of ['greedy', 'lanes'] as Strategy[]) {
      for (let seed = 1; seed <= 25; seed++) {
        let state = createGame({ seed })
        while (state.status === 'playing') {
          const result = apply(state, nextBotAction(state, strategy))
          if (!result.ok) throw new Error(result.reason)
          assert.deepEqual(result.events.reduce(step, project(state)), project(result.state), `seed ${seed}`)
          state = result.state
          moves++
        }
      }
    }
    assert.ok(moves > 1000, `only ${moves} moves were checked`)
  })

  it('finds a unit in the hand or on any row', () => {
    const view = project(createGame({ seed: 3 }))
    const first = view.hand[0]
    const queued = view.back.find(Boolean)
    assert.deepEqual(first && locate(view, first.uid), { at: 'hand', index: 0 })
    assert.equal(queued && locate(view, queued.uid)?.at, 'back')
    assert.equal(locate(view, 9_999), null)
  })
})
