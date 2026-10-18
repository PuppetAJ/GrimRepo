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
    const died = (line: string) => / died\./.test(line)
    while (state.status === 'playing' && !lines.some(died)) {
      const result = step(state, nextBotAction(state))
      lines.push(...narrate(state, result.events))
      state = result.state
    }
    const death = lines.find(died)
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

  it('calls a card destroyed the turn it was played a misplay', () => {
    let state = step(createGame({ seed: 11 }), { type: 'draw', from: 'boilerplate' }).state
    state.opponent.front[0] = { uid: 999, card: 'Mainframe', attack: 13, health: 13, maxHealth: 13, sigils: [] }
    const filler = state.player.hand.find((unit) => unit.card === 'Boilerplate')?.uid as number
    state = step(state, { type: 'select', uid: filler }).state
    state = step(state, { type: 'place', lane: 0 }).state
    const bell = step(state, { type: 'ringBell' })
    assert.ok(narrate(state, bell.events).some((line) => line.endsWith('Total misplay.')))
    assert.equal(bell.state.placed, undefined)
  })

  it('remarks on every second Boilerplate in hand, never two in a row', () => {
    const start = createGame({ seed: 11 })
    const filler = start.player.hand.find((unit) => unit.card === 'Boilerplate')
    const said = [1, 2, 3, 4].map((held) => {
      const state = structuredClone(start)
      state.player.hand = state.player.hand.filter((unit) => unit.card !== 'Boilerplate')
      for (let n = 0; n < held; n++)
        state.player.hand.push({ ...(filler as (typeof state.player.hand)[number]), uid: 900 + n })
      const drew = step(state, { type: 'draw', from: 'boilerplate' })
      return narrate(state, drew.events).some((line) => line.startsWith('Boilerplate again'))
    })
    assert.deepEqual(said, [true, false, true, false])
  })

  it('refuses a record that breaks the rules', () => {
    assert.equal(history(23, [{ type: 'ringBell' }]), null)
  })
})
