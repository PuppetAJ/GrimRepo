import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Rng } from '../rng.ts'
import { playOut } from './bot.ts'
import { apply, createGame, legalActions, replay, summary } from './game.ts'
import { HAND_LIMIT, LANES, TURN_LIMIT, type Action, type GameState } from './types.ts'
import { units } from './units.ts'

const step = (state: GameState, action: Action) => {
  const result = apply(state, action)
  if (!result.ok) throw new Error(`${JSON.stringify(action)}: ${result.reason}`)
  return result.state
}

describe('a recorded game', () => {
  it('replays to exactly the same end from its seed and actions', () => {
    const { state, actions } = playOut(createGame({ seed: 2026 }), step)
    const again = replay(2026, actions)
    assert.ok(again.ok)
    assert.deepEqual(again.state, state)
    assert.deepEqual(summary(again.state), summary(state))
  })

  it('is invalid if any step breaks the rules', () => {
    const { actions } = playOut(createGame({ seed: 2026 }), step)
    const forged: Action[] = [...actions.slice(0, 1), { type: 'ringBell' }, { type: 'ringBell' }]
    const result = replay(2026, forged)
    assert.ok(!result.ok)
  })

  it('does not replay under a different seed', () => {
    const original = playOut(createGame({ seed: 2026 }), step)
    const other = replay(2027, original.actions)
    // Another seed deals other cards, so the same moves either break the rules or end somewhere else.
    assert.ok(!other.ok || JSON.stringify(other.state) !== JSON.stringify(original.state))
  })

  it('cannot reach the debug card without the debug option', () => {
    const debugGame = createGame({ seed: 5, debug: true })
    const y2k = debugGame.player.hand.find((unit) => unit.card === 'Y2K')?.uid as number
    const actions: Action[] = [
      { type: 'draw', from: 'boilerplate' },
      { type: 'select', uid: y2k },
      { type: 'place', lane: 0 },
      { type: 'ringBell' },
    ]
    const withDebug = replay(5, actions, { debug: true })
    assert.ok(withDebug.ok && withDebug.state.status === 'won')
    assert.ok(!replay(5, actions).ok, 'the same record without debug refers to a card that was never dealt')
  })
})

describe('a thousand random games', () => {
  it('all end, and never break an invariant on the way', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = new Rng(seed * 7919)
      let state = createGame({ seed })
      let moves = 0
      while (state.status === 'playing') {
        const legal = legalActions(state)
        // Ring the bell often enough that random play does not wander forever.
        const action =
          rng.float() < 0.3 && legal.some((a) => a.type === 'ringBell')
            ? ({ type: 'ringBell' } as Action)
            : rng.pick(legal)
        state = step(state, action)
        moves += 1
        assert.ok(moves < 50_000, `seed ${seed} never ended`)

        assert.ok(state.player.health >= 0 && state.opponent.health >= 0)
        assert.ok(state.player.hand.length <= HAND_LIMIT)
        assert.equal(state.player.board.length, LANES)
        const uids = [
          ...state.player.hand,
          ...units(state.player.board),
          ...units(state.opponent.front),
          ...units(state.opponent.back),
        ].map((unit) => unit.uid)
        assert.equal(new Set(uids).size, uids.length, `seed ${seed}: a card is in two places`)
        for (const unit of [
          ...units(state.player.board),
          ...units(state.opponent.front),
          ...units(state.opponent.back),
        ]) {
          assert.ok(
            unit.health > 0 || unit.card === 'FourOhFour',
            `seed ${seed}: a dead ${unit.card} is still on the table`,
          )
        }
      }
      const result = summary(state)
      assert.ok(result && result.turns >= 1 && result.turns <= TURN_LIMIT)
    }
  })
})

describe('the balance', () => {
  it('gives a simple bot a fair fight', () => {
    let wins = 0
    const turns: number[] = []
    for (let seed = 1; seed <= 500; seed++) {
      const result = summary(playOut(createGame({ seed }), step).state)
      assert.ok(result, `seed ${seed} did not finish`)
      if (result.outcome === 'win') wins += 1
      turns.push(result.turns)
    }
    const rate = wins / 500
    // A greedy bot should win some and lose some; either extreme means the numbers need tuning.
    assert.ok(rate > 0.2 && rate < 0.8, `the bot won ${(rate * 100).toFixed(1)}%`)
    assert.ok(Math.max(...turns) < 60, `a game went ${Math.max(...turns)} turns`)
  })
})
