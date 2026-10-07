import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card, CARDS, deathCardId, EVENT_ONLY, PLAYER_DECK, SHIPS_AS } from '../cards.ts'
import { attackIn, kin, reinforce } from './combat.ts'
import { createGame } from './game.ts'
import type { GameEvent, Slot } from './types.ts'
import { makeUnit } from './units.ts'

const game = () => createGame({ seed: 1 })
const row = (...ids: (string | null)[]): Slot[] => {
  const state = game()
  return ids.map((id) => (id ? makeUnit(state, id) : null))
}

describe('card types', () => {
  it('give every card a player can hold a type', () => {
    for (const id of [...PLAYER_DECK, ...EVENT_ONLY, ...Object.values(SHIPS_AS)]) assert.ok(card(id).type, id)
  })

  it("leave the fuel and P03's tokens untyped", () => {
    for (const id of ['Boilerplate', 'OutOfMemory', 'Y2K']) assert.equal(CARDS[id]?.type, undefined)
  })

  it('give a death card the type of the card whose stats it took', () => {
    const death = deathCardId({ name: 'Typed', cost: 1, attack: 2, health: 2, art: 'SpamBot', sigils: [] })
    assert.equal(card(death).type, 'bot')
  })
})

describe('Scale Out', () => {
  it('adds 1 attack for each other card of its type on its row, and none for other types', () => {
    const board = row('Botnet', 'SpamBot', 'Crawler', 'Bug')
    assert.equal(kin(board, 0), 2)
    assert.equal(attackIn(board, row(null, null, null, null), 0), 1 + 2)
    assert.equal(attackIn(row('Botnet', 'Bug', null, null), row(null, null, null, null), 0), 1)
  })
})

describe('Redundancy', () => {
  it('gains 1 health for each card of its type already on its side as it lands, and keeps it', () => {
    const board = row('LegacyCode', 'Monolith', 'Mainframe', 'SpamBot')
    const events: GameEvent[] = []
    reinforce(board, 1, events)
    assert.deepEqual([board[1]?.health, board[1]?.maxHealth], [4, 4])
    assert.equal(events[0]?.type, 'buffed')
    board[0] = null
    assert.equal(board[1]?.health, 4)
  })

  it('does nothing alone or on a card without it', () => {
    const lonely = row('Monolith', 'SpamBot', null, null)
    const events: GameEvent[] = []
    reinforce(lonely, 0, events)
    reinforce(lonely, 1, events)
    assert.equal(lonely[0]?.health, 2)
    assert.deepEqual(events, [])
  })
})
