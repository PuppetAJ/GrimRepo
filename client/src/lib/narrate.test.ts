import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGame, nextBotAction, apply, type Action, type GameState } from 'shared'
import { history, narrate, opening } from './narrate.ts'

const step = (state: GameState, action: Action) => {
  const result = apply(state, action)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('the console', () => {
  it('opens with P03’s queued cards', () => {
    const state = createGame({ seed: 11 })
    const queued = state.opponent.back.filter(Boolean).length
    assert.equal(opening(state).filter((line) => line.startsWith('I queued')).length, queued)
  })

  it('names a card in the line that reports its death', () => {
    let state = createGame({ seed: 11 })
    const lines: string[] = []
    while (state.status === 'playing' && !lines.some((line) => line.endsWith(' died.'))) {
      const result = step(state, nextBotAction(state))
      lines.push(...narrate(state, result.events))
      state = result.state
    }
    const death = lines.find((line) => line.endsWith(' died.'))
    assert.ok(death && !death.includes('a card'), String(death))
  })

  it('rebuilds the same story from the saved moves as was told live', () => {
    let state = createGame({ seed: 23 })
    const live = opening(state)
    const actions: Action[] = []
    for (let move = 0; move < 60 && state.status === 'playing'; move++) {
      const action = nextBotAction(state)
      const result = step(state, action)
      live.push(...narrate(state, result.events))
      actions.push(action)
      state = result.state
    }
    assert.deepEqual(history(23, actions)?.lines, live)
  })

  it('refuses a record that breaks the rules', () => {
    assert.equal(history(23, [{ type: 'ringBell' }]), null)
  })
})
