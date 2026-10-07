import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ItemId } from '../items.ts'
import { legalActions } from './game.ts'
import { cardAt, play, refused, table } from './test-support.ts'
import type { GameState } from './types.ts'

const kit = (state: GameState, ...items: ItemId[]) => ({ ...state, items })

describe('the items', () => {
  it('the Hammer destroys one of your own cards, and Hot Reload brings it back', () => {
    const start = kit(table({ board: ['Bug'] }), 'hammer')
    const { state, events } = play(start, { type: 'use', slot: 0, row: 'board', lane: 0 })
    assert.equal(cardAt(state.player.board, 0), null)
    assert.ok(
      state.player.hand.some((unit) => unit.card === 'Bug'),
      'the reload',
    )
    assert.deepEqual(state.items, [], 'and it is used up')
    assert.ok(events.some((event) => event.type === 'used' && event.item === 'hammer'))
  })

  it("the Pliers pull every sigil off one of P03's cards", () => {
    const start = kit(table({ front: ['JSONFoorhees'] }), 'pliers')
    const { state } = play(start, { type: 'use', slot: 0, row: 'front', lane: 0 })
    assert.deepEqual(state.opponent.front[0]?.sigils, [])
  })

  it('the Hourglass makes P03 sit out its next turn', () => {
    const start = kit(table({ front: ['Mainframe'] }), 'hourglass')
    const { state, events } = play(start, { type: 'use', slot: 0 }, { type: 'ringBell' })
    assert.equal(state.scale, 0, 'the Mainframe never swung')
    assert.ok(events.some((event) => event.type === 'skipped'))
    assert.equal(state.skipOpponent, false, 'only once')
  })

  it("the Hook pulls P03's card into your empty lane opposite", () => {
    const start = kit(table({ front: ['Mainframe'] }), 'hook')
    const { state } = play(start, { type: 'use', slot: 0, row: 'front', lane: 0 })
    assert.equal(cardAt(state.player.board, 0), 'Mainframe')
    assert.equal(cardAt(state.opponent.front, 0), null)
    const blocked = kit(table({ board: ['CopyPaste'], front: ['Mainframe'] }), 'hook')
    assert.match(refused(blocked, { type: 'use', slot: 0, row: 'front', lane: 0 }), /must be empty/)
  })

  it('the Bottled Boilerplate puts two Boilerplates in the hand', () => {
    const start = kit(table({}), 'bottle')
    const { state } = play(start, { type: 'use', slot: 0 })
    assert.equal(state.player.hand.filter((unit) => unit.card === 'Boilerplate').length, 2)
  })

  it("the Scissors cut P03's card, front or queued", () => {
    const start = kit(table({ back: ['Mainframe'] }), 'scissors')
    const { state } = play(start, { type: 'use', slot: 0, row: 'back', lane: 0 })
    assert.equal(cardAt(state.opponent.back, 0), null)
  })

  it('are offered only where they can be aimed, and refused before the draw', () => {
    const start = kit(table({ board: ['CopyPaste'], front: ['Mainframe'] }), 'hook', 'pliers')
    const uses = legalActions(start).filter((action) => action.type === 'use')
    assert.deepEqual(uses, [{ type: 'use', slot: 1, row: 'front', lane: 0 }], 'the Hook has no empty lane to pull into')
    assert.equal(refused({ ...start, drawn: false }, { type: 'use', slot: 1, row: 'front', lane: 0 }), 'Draw first')
  })
})
