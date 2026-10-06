import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardAt, play, table, uidOf } from './test-support.ts'
import type { GameEvent, GameState } from './types.ts'

const bell = (state: GameState) => play(state, { type: 'ringBell' })
const hits = (events: GameEvent[], side: 'player' | 'opponent') =>
  events
    .filter((event) => event.type === 'hit' && event.side === side)
    .reduce((sum, event) => sum + (event.type === 'hit' ? event.amount : 0), 0)
const dealt = (events: GameEvent[]) => events.find((event) => event.type === 'damaged')

describe('the sigils', () => {
  it('Fatal Error destroys any card it damages', () => {
    const { events } = bell(table({ board: ['NullPointer'], front: ['Bug'] }))
    assert.ok(events.some((event) => event.type === 'killed' && event.side === 'opponent'))
  })

  it('Rollback shrugs off the first damage, and only the first', () => {
    const { state, events } = bell(table({ board: ['CopyPaste', 'CopyPaste'], front: ['JSONFoorhees'] }))
    assert.ok(events.some((event) => event.type === 'shielded'))
    assert.equal(state.opponent.front[0]?.health, 8, 'the first hit did nothing')
    // The second Copy Paste, moved opposite it, lands its hit.
    const again = {
      ...state,
      drawn: true,
      player: { ...state.player, board: [state.player.board[1] ?? null, null, null, null] },
    }
    const { state: after } = bell(again)
    assert.equal(after.opponent.front[0]?.health, 5, 'the second hit landed')
  })

  it('Tech Lead gives the cards beside it +1 attack', () => {
    const { events } = bell(table({ board: ['GrimRepo', 'CopyPaste'] }))
    assert.equal(hits(events, 'opponent'), 3 + 4)
  })

  it('Packet Loss takes 1 from the attack of the card opposite', () => {
    const { events } = bell(table({ board: ['CopyPaste'], front: ['SpamBot'] }))
    const hit = dealt(events)
    assert.equal(hit?.type === 'damaged' && hit.amount, 2)
  })

  it('Pop-up adds 1 to the attack of the card opposite', () => {
    const { events } = bell(table({ board: ['CopyPaste'], front: ['Cookie'] }))
    const hit = dealt(events)
    assert.equal(hit?.type === 'damaged' && hit.amount, 4)
  })

  it('Retry attacks twice', () => {
    const { events } = bell(table({ board: ['InfiniteLoop'] }))
    assert.equal(hits(events, 'opponent'), 2)
  })

  it('Deprecated dies after it attacks', () => {
    const { state, events } = bell(table({ board: ['DestroyEnemyYou'] }))
    assert.equal(hits(events, 'opponent'), 8)
    assert.equal(cardAt(state.player.board, 0), null)
  })

  it('Scope Creep gains 1 attack for each card it destroys', () => {
    const { state, events } = bell(table({ board: ['Crawler'], front: ['HelloWorld'] }))
    assert.ok(events.some((event) => event.type === 'buffed'))
    assert.equal(state.player.board[0]?.attack, 6)
  })

  it('Broadcast attacks the lane opposite and both lanes beside it', () => {
    const { events } = bell(table({ board: [null, 'HelloWorld'] }))
    assert.equal(hits(events, 'opponent'), 3)
  })

  it('Refactor hands its stats to the card it pays for', () => {
    const start = table({ hand: ['LegacyCode'], board: ['OffCenterDiv'] })
    const { state } = play(
      start,
      { type: 'select', uid: uidOf(start, 'LegacyCode') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    const placed = state.player.board[0]
    assert.equal(placed?.card, 'LegacyCode')
    assert.equal(placed?.attack, 3)
    assert.equal(placed?.health, 4 + 6)
  })
})

describe('the sigils that move cards', () => {
  it('Failover moves to take an attack aimed at an empty lane', () => {
    const { state, events } = bell(table({ board: [null, null, null, 'MergeConflict'], front: ['CopyPaste'] }))
    assert.ok(events.some((event) => event.type === 'moved' && event.side === 'player' && event.to === 0))
    assert.equal(state.player.board[0]?.card, 'MergeConflict')
    assert.equal(hits(events, 'player'), 0, 'the attack hit the card, not the player')
  })

  it('Load Balancer moves on after it attacks, and attacks only once', () => {
    const { state, events } = bell(table({ board: ['ZeroDay'] }))
    assert.equal(hits(events, 'opponent'), 4)
    assert.equal(state.player.board[1]?.card, 'ZeroDay')
  })

  it('Hot Reload sends a fresh copy back to the hand when the card dies', () => {
    const start = table({ board: ['Bug'], front: ['NullPointer'] })
    const { state, events } = bell(start)
    assert.ok(events.some((event) => event.type === 'reloaded' && event.lane === null))
    assert.ok(state.player.hand.some((unit) => unit.card === 'Bug' && unit.health === 8))
  })

  it('Beta ships as its stronger form after a round on the table', () => {
    const { state, events } = bell(table({ board: ['Prototype'] }))
    assert.ok(events.some((event) => event.type === 'shipped'))
    assert.equal(state.player.board[0]?.card, 'ShippedFeature')
    assert.equal(state.player.board[0]?.attack, 4)
  })
})
