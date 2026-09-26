import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardAt, play, table } from './test-support.ts'
import type { GameEvent, GameState } from './types.ts'

const bell = (state: GameState) => play(state, { type: 'ringBell' })
const hits = (events: GameEvent[], side: 'player' | 'opponent') =>
  events
    .filter((event) => event.type === 'hit' && event.side === side)
    .reduce((sum, event) => sum + (event.type === 'hit' ? event.amount : 0), 0)

describe('combat', () => {
  it('hits the opponent directly through an empty lane', () => {
    const { state, events } = bell(table({ board: ['GoogleFu'] }))
    assert.equal(hits(events, 'opponent'), 3)
    assert.equal(state.scale, 3, 'and tips the scale toward the player')
  })

  it("lets P03's hits tip the scale back, so a lead can be lost", () => {
    const { state } = bell(table({ front: ['GoogleFu'], scale: 5 }))
    assert.equal(state.scale, 2)
  })

  it('damages the card opposite instead, and leaves it wounded', () => {
    const { state } = bell(table({ board: ['GoogleFu'], front: ['Firewall'] }))
    assert.equal(state.opponent.front[0]?.health, 3)
    assert.equal(state.scale, 0)
  })

  it('kills a card whose health runs out', () => {
    const { state, events } = bell(table({ board: ['GitSome'], front: ['GrimRepo'] }))
    assert.ok(events.some((event) => event.type === 'killed' && event.side === 'opponent'))
    assert.equal(state.scale, 0, 'a card that dies still blocks the hit')
  })

  it('carries overkill into the card queued behind', () => {
    // JACK deals 13 to a Loop with 2 health: 11 carries on into the Bug behind it, which has 8.
    const { events } = bell(table({ board: ['JACK'], front: ['Loop'], back: ['Bug'] }))
    const overkill = events.find((event) => event.type === 'overkill')
    assert.equal(overkill?.type === 'overkill' && overkill.amount, 11)
    assert.ok(events.some((event) => event.type === 'killed' && event.row === 'back'))
  })

  it('never lets overkill reach a player', () => {
    const { state } = bell(table({ board: ['JACK'], front: ['Loop'] }))
    assert.equal(state.scale, 0)
  })

  it('does nothing with a card that has no attack', () => {
    const { events } = bell(table({ board: ['Bug'] }))
    assert.ok(!events.some((event) => event.type === 'attacked' && event.side === 'player'))
  })

  it('lets Bypass hit the opponent over a card in the way', () => {
    const state = table({ board: ['GoogleFu'], front: ['Bug'] })
    ;(state.player.board[0] as { sigils: string[] }).sigils.push('bypass')
    const after = bell(state).state
    assert.equal(after.scale, 3)
    assert.equal(after.opponent.front[0]?.health, 8)
  })

  it('lets Fork strike the lanes either side instead of the one opposite', () => {
    const state = table({ board: [null, 'GoogleFu'], front: ['Bug', 'Bug', 'Bug'] })
    ;(state.player.board[1] as { sigils: string[] }).sigils.push('fork')
    const after = bell(state).state
    assert.deepEqual(
      after.opponent.front.slice(0, 3).map((unit) => unit?.health),
      [5, 8, 5],
    )
  })

  it('makes an attacker pay for hitting a Rate Limiter, even to death', () => {
    const state = table({ board: ['GitSome'], front: ['Firewall'] })
    ;(state.opponent.front[0] as { sigils: string[] }).sigils.push('rate_limiter')
    const { state: after, events } = bell(state)
    assert.ok(events.some((event) => event.type === 'struckBack'))
    assert.equal(cardAt(after.player.board, 0), null, 'GitSome has 1 health, so the strike back kills it')
  })

  it('heals Hotfix cards by one at the end of the turn, never past full', () => {
    const state = table({ board: ['Firewall', 'Bug'] })
    const [wounded, whole] = state.player.board as unknown as [
      { health: number; sigils: string[] },
      { sigils: string[] },
    ]
    wounded.health = 3
    wounded.sigils.push('hotfix')
    whole.sigils.push('hotfix')
    const after = bell(state).state
    assert.equal(after.player.board[0]?.health, 4)
    assert.equal(after.player.board[1]?.health, 8)
  })
})
