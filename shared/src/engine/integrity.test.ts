import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DESPERATE_CARDS } from '../encounters.ts'
import { UPTIME_LIMIT } from './combat.ts'
import { DESPERATE_AT, EASE_AT } from './opponent.ts'
import { legalActions } from './game.ts'
import { play, refused, table, uidOf } from './test-support.ts'
import type { GameEvent, GameState } from './types.ts'

const bell = (state: GameState) => play(state, { type: 'ringBell' })
const changes = (events: GameEvent[]) => events.flatMap((event) => (event.type === 'integrity' ? [event.change] : []))
const queued = (events: GameEvent[]) => events.filter((event) => event.type === 'queued')

describe("a run's integrity", () => {
  it('costs 1 for each card P03 destroys', () => {
    // Sandbox outlasts Cron Job's 1 and destroys it.
    const { state, events } = bell(table({ board: ['CronJob'], front: ['Sandbox'], integrity: 20 }))
    assert.deepEqual(changes(events), [-1])
    assert.equal(state.integrity?.left, 19)
  })

  it('costs nothing for a Boilerplate, a sacrifice or a quick battle', () => {
    assert.deepEqual(changes(bell(table({ board: ['Boilerplate'], front: ['Sandbox'], integrity: 20 })).events), [])
    const start = table({ hand: ['LegacyCode'], board: ['SpamBot'], integrity: 20 })
    const sacrificed = play(start, { type: 'select', uid: uidOf(start, 'LegacyCode') }, { type: 'mark', lane: 0 })
    assert.deepEqual(changes(play(sacrificed.state, { type: 'place', lane: 0 }).events), [])
    assert.deepEqual(changes(bell(table({ board: ['CronJob'], front: ['Sandbox'] })).events), [])
  })

  it('counts a card a P03 Backtrace strikes back at, but not one that dies of its own Deprecated', () => {
    assert.deepEqual(changes(bell(table({ board: ['CopyPaste'], front: ['Watchdog'], integrity: 20 })).events), [-1])
    assert.deepEqual(changes(bell(table({ board: ['DestroyEnemyYou'], integrity: 20 })).events), [])
  })

  it('loses the battle the moment it runs out', () => {
    const { state, events } = bell(table({ board: ['CronJob'], front: ['Sandbox'], integrity: 1 }))
    assert.equal(state.status, 'lost')
    assert.equal(state.integrity?.left, 0)
    assert.ok(events.some((event) => event.type === 'gameOver' && event.outcome === 'loss'))
  })

  it('is repaired by an Uptime card blocking an attack, up to its limit a battle and never past full', () => {
    // Sandbox heals what COBOL deals it, and COBOL is made tough enough to outlast every turn.
    let state = table({ board: ['COBOL'], front: ['Sandbox'], integrity: 10 })
    Object.assign(state.player.board[0] ?? {}, { health: 50, maxHealth: 50 })
    const repairs: number[] = []
    for (let turn = 0; turn < UPTIME_LIMIT + 2; turn++) {
      const result = bell({ ...state, drawn: true, scale: 0 })
      repairs.push(...changes(result.events))
      state = result.state
    }
    assert.deepEqual(repairs, Array(UPTIME_LIMIT).fill(1))
    assert.equal(state.integrity?.left, 10 + UPTIME_LIMIT)
    assert.deepEqual(changes(bell(table({ board: ['COBOL'], front: ['Sandbox'], integrity: 20 })).events), [])
  })
})

describe('comebacks in a run battle', () => {
  it('let the player draw a second card from the deck while P03 leads, after the first', () => {
    const behind = bell(table({ encounter: 'localhost-hello', scale: -2 })).state
    assert.equal(behind.catchUp, true)
    assert.ok(!legalActions(behind).some((action) => action.type === 'ringBell'), 'the turn still starts with a draw')
    const drawn = play(behind, { type: 'draw', from: 'deck' }).state
    assert.ok(legalActions(drawn).some((action) => action.type === 'draw' && action.from === 'deck'))
    assert.match(refused(drawn, { type: 'draw', from: 'boilerplate' }), /No more draws/)
    const { state: twice, events } = play(drawn, { type: 'draw', from: 'deck' })
    assert.ok(events.some((event) => event.type === 'drew' && event.catchUp))
    assert.equal(twice.player.hand.length, drawn.player.hand.length + 1)
    assert.match(refused(twice, { type: 'draw', from: 'deck' }), /No more draws/, 'once a turn')
    assert.ok(!bell(table({ encounter: 'localhost-hello', scale: 2 })).state.catchUp)
    assert.ok(!bell(table({ scale: -2 })).state.catchUp, 'and only in a run battle')
  })

  it("make P03 ease off well ahead, but never in a boss's battle", () => {
    assert.equal(queued(bell(table({ encounter: 'localhost-hello', scale: -EASE_AT })).events).length, 0)
    assert.ok(queued(bell(table({ encounter: 'localhost-hello', scale: 1 - EASE_AT })).events).length > 0)
    assert.ok(queued(bell(table({ encounter: 'localhost-boss', scale: -EASE_AT })).events).length > 0)
  })

  it('give P03 one desperate play a battle, far behind, from its stage’s cards', () => {
    const first = bell(table({ encounter: 'staging-null', scale: DESPERATE_AT }))
    const desperate = queued(first.events).filter((event) => event.type === 'queued' && event.desperate)
    assert.equal(desperate.length, 1)
    assert.ok(DESPERATE_CARDS[1]?.includes(desperate[0]?.type === 'queued' ? desperate[0].unit.card : ''))
    const again = bell({ ...first.state, drawn: true, scale: DESPERATE_AT })
    assert.ok(!again.events.some((event) => event.type === 'queued' && event.desperate), 'once a battle')
    const short = bell(table({ encounter: 'staging-null', scale: DESPERATE_AT - 1 }))
    assert.ok(!short.events.some((event) => event.type === 'queued' && event.desperate))
  })
})
