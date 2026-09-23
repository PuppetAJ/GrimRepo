import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SCORE_TURN_BASELINE, scoreBattle } from './scoring.ts'

describe('scoreBattle', () => {
  it('scores a faster win higher, all the way down', () => {
    for (let turns = 1; turns < SCORE_TURN_BASELINE + 5; turns++) {
      assert.ok(scoreBattle('win', turns) >= scoreBattle('win', turns + 1), `turn ${turns} vs ${turns + 1}`)
    }
  })

  it('never scores a win below a win with no speed bonus', () => {
    assert.equal(scoreBattle('win', 500), 1000)
  })

  it('always scores a win above any loss a real game could reach', () => {
    assert.ok(scoreBattle('win', 500) > scoreBattle('loss', 99))
  })

  it('scores a loss by the turns survived', () => {
    assert.equal(scoreBattle('loss', 7), 70)
  })

  it('refuses a turn count no game could produce', () => {
    for (const turns of [0, -1, 2.5, Number.NaN]) assert.throws(() => scoreBattle('win', turns), RangeError)
  })
})
