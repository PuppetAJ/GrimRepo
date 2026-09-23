import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BOILERPLATE, CARDS, DEBUG_CARD, OPPONENT_POOL, PLAYER_DECK, SIGILS } from './cards.ts'
import { Rng } from './rng.ts'

describe('the cards', () => {
  it('keep the 2022 stats', () => {
    assert.deepEqual([CARDS['JACK']?.attack, CARDS['JACK']?.health, CARDS['JACK']?.cost], [13, 13, 3])
    assert.deepEqual([CARDS['FourOhFour']?.attack, CARDS['FourOhFour']?.health, CARDS['FourOhFour']?.cost], [4, 0, 4])
    assert.equal(CARDS['HelloWorld']?.name, 'Hello World')
  })

  it('make a deck of 25: everything but the debug card and Boilerplate', () => {
    assert.equal(PLAYER_DECK.length, 25)
    assert.ok(!PLAYER_DECK.includes(DEBUG_CARD) && !PLAYER_DECK.includes(BOILERPLATE))
    assert.equal(new Set(PLAYER_DECK).size, 25)
  })

  it('give the opponent every deck card but the board wipe', () => {
    assert.equal(OPPONENT_POOL.length, 24)
    assert.ok(!OPPONENT_POOL.includes('FourOhFour'))
  })

  it('only name sigils that exist', () => {
    for (const def of Object.values(CARDS)) for (const sigil of def.sigils) assert.ok(SIGILS[sigil], sigil)
  })

  it('make Boilerplate a free 0/1', () => {
    assert.deepEqual([CARDS[BOILERPLATE]?.attack, CARDS[BOILERPLATE]?.health, CARDS[BOILERPLATE]?.cost], [0, 1, 0])
  })
})

describe('the random generator', () => {
  it('repeats itself exactly for a seed', () => {
    const a = new Rng(1234)
    const b = new Rng(1234)
    for (let i = 0; i < 100; i++) assert.equal(a.float(), b.float())
  })

  it('draws evenly', () => {
    const rng = new Rng(9)
    const counts = [0, 0, 0, 0, 0]
    for (let i = 0; i < 50_000; i++) counts[rng.int(0, 4)] = (counts[rng.int(0, 4)] ?? 0) + 1
    for (const count of counts) assert.ok(Math.abs(count / 50_000 - 0.2) < 0.02, counts.join(', '))
  })

  it('shuffles without losing or duplicating anything', () => {
    const shuffled = new Rng(3).shuffle(PLAYER_DECK)
    assert.deepEqual([...shuffled].sort(), [...PLAYER_DECK].sort())
  })
})
