import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BOILERPLATE, CARDS, DEBUG_CARD, PLAYER_DECK } from '../cards.ts'
import { apply, createGame } from './game.ts'
import { cardAt, play, refused, table, uidOf } from './test-support.ts'
import { HAND_LIMIT } from './types.ts'

describe('the opening', () => {
  it('deals three from the deck and one Boilerplate', () => {
    const state = createGame({ seed: 42 })
    assert.equal(state.player.hand.length, 4)
    assert.equal(state.player.hand.filter((unit) => unit.card === BOILERPLATE).length, 1)
    assert.equal(state.player.deck.length, PLAYER_DECK.length - 3)
  })

  it('never deals the debug card, unless asked for it in development', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = createGame({ seed })
      assert.ok(![...state.player.hand.map((unit) => unit.card), ...state.player.deck].includes(DEBUG_CARD))
    }
    assert.ok(createGame({ seed: 1, debug: true }).player.hand.some((unit) => unit.card === DEBUG_CARD))
  })

  it('never gives the opponent the board wipe', () => {
    assert.ok(!CARDS['FourOhFour']?.sigils.every((sigil) => sigil !== 'segfault'))
    for (let seed = 0; seed < 200; seed++) {
      const queued = createGame({ seed }).opponent.back.filter(Boolean)
      assert.ok(queued.every((unit) => unit?.card !== 'FourOhFour'))
    }
  })

  it('queues one to three cheap cards for the opponent, none on the front row yet', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { opponent } = createGame({ seed })
      const queued = opponent.back.filter(Boolean)
      assert.ok(queued.length >= 1 && queued.length <= 3, `seed ${seed}: ${queued.length}`)
      assert.ok(queued.every((unit) => CARDS[unit?.card as string]?.cost === 0))
      assert.ok(opponent.front.every((slot) => slot === null))
    }
  })

  it('is the same game every time for the same seed', () => {
    assert.deepEqual(createGame({ seed: 99 }), createGame({ seed: 99 }))
    assert.notDeepEqual(createGame({ seed: 99 }).player.deck, createGame({ seed: 100 }).player.deck)
  })
})

describe('drawing', () => {
  it('comes first: nothing else is allowed until the turn’s draw', () => {
    const state = createGame({ seed: 3 })
    const first = state.player.hand[0]?.uid as number
    assert.equal(refused(state, { type: 'select', uid: first }), 'Draw first')
    assert.equal(refused(state, { type: 'ringBell' }), 'Draw first')
  })

  it('takes one card, from the deck or the Boilerplate pile, and only one', () => {
    const state = createGame({ seed: 3 })
    const fromDeck = play(state, { type: 'draw', from: 'deck' }).state
    assert.equal(fromDeck.player.hand.length, 5)
    assert.equal(fromDeck.player.deck.length, state.player.deck.length - 1)
    assert.equal(refused(fromDeck, { type: 'draw', from: 'deck' }), 'No more draws this turn')

    const fuel = play(state, { type: 'draw', from: 'boilerplate' }).state
    assert.equal(fuel.player.hand.at(-1)?.card, BOILERPLATE)
    assert.equal(fuel.player.deck.length, state.player.deck.length, 'the deck is untouched')
  })

  it('is skipped for the whole turn when it begins with a full hand', () => {
    const next = play(table({ hand: Array(HAND_LIMIT).fill('InfiniteLoop') }), { type: 'ringBell' }).state
    assert.equal(next.status, 'playing')
    assert.equal(refused(next, { type: 'draw', from: 'deck' }), 'The hand is full')
    const played = play(next, { type: 'select', uid: uidOf(next, 'InfiniteLoop') }, { type: 'place', lane: 0 }).state
    assert.equal(played.player.hand.length, HAND_LIMIT - 1)
    assert.equal(refused(played, { type: 'draw', from: 'deck' }), 'No more draws this turn')
    assert.ok(apply(played, { type: 'ringBell' }).ok, 'the bell rings without a draw')
  })

  it('rebuilds an empty deck from the cards not in hand or on the table', () => {
    const state = table({ hand: ['Mainframe'], board: ['Bug'] })
    state.player.deck = []
    state.drawn = false
    const { state: after, events } = play(state, { type: 'draw', from: 'deck' })
    assert.ok(events.some((event) => event.type === 'reshuffled'))
    const drawn = after.player.hand.at(-1)?.card
    assert.ok(drawn && drawn !== 'Mainframe' && drawn !== 'Bug', `drew ${drawn}`)
    assert.ok(!after.player.deck.includes('Mainframe') && !after.player.deck.includes('Bug'))
  })
})

describe('summoning', () => {
  it('places a free card in an empty lane, and never on top of another', () => {
    const state = table({ hand: ['InfiniteLoop', 'CopyPaste'], board: [null, 'Bug'] })
    const placed = play(state, { type: 'select', uid: uidOf(state, 'InfiniteLoop') }, { type: 'place', lane: 0 }).state
    assert.equal(cardAt(placed.player.board, 0), 'InfiniteLoop')
    assert.equal(placed.player.hand.length, 1)

    const blocked = play(placed, { type: 'select', uid: uidOf(placed, 'CopyPaste') }).state
    assert.equal(refused(blocked, { type: 'place', lane: 1 }), 'That lane is taken')
  })

  it('refuses a costly card when the table cannot pay for it', () => {
    const state = table({ hand: ['ForkBomb'], board: ['InfiniteLoop'] })
    assert.equal(
      refused(state, { type: 'select', uid: uidOf(state, 'ForkBomb') }),
      'Not enough on the table to sacrifice',
    )
  })

  it('kills the marked cards only when the summon completes', () => {
    const state = table({ hand: ['ForkBomb'], board: ['InfiniteLoop', 'HelloWorld'] })
    const marked = play(
      state,
      { type: 'select', uid: uidOf(state, 'ForkBomb') },
      { type: 'mark', lane: 0 },
      { type: 'mark', lane: 1 },
    ).state
    assert.equal(cardAt(marked.player.board, 0), 'InfiniteLoop', 'still alive while only marked')

    const { state: summoned, events } = play(marked, { type: 'place', lane: 0 })
    assert.equal(cardAt(summoned.player.board, 0), 'ForkBomb')
    assert.equal(cardAt(summoned.player.board, 1), null)
    assert.equal(events.filter((event) => event.type === 'sacrificed').length, 2)
  })

  it('spares every marked card when the summon is cancelled', () => {
    const state = table({ hand: ['ForkBomb'], board: ['InfiniteLoop', 'HelloWorld'] })
    const { state: after } = play(
      state,
      { type: 'select', uid: uidOf(state, 'ForkBomb') },
      { type: 'mark', lane: 0 },
      { type: 'cancel' },
    )
    assert.deepEqual([cardAt(after.player.board, 0), cardAt(after.player.board, 1)], ['InfiniteLoop', 'HelloWorld'])
    assert.ok(after.player.hand.some((unit) => unit.card === 'ForkBomb'))
  })

  it('counts a free card as one and a costly card as its cost', () => {
    // Firewall costs 1, so it pays 1 of ForkBomb's 2 and a free InfiniteLoop pays the other.
    const state = table({ hand: ['ForkBomb'], board: ['Firewall', 'InfiniteLoop'] })
    const half = play(state, { type: 'select', uid: uidOf(state, 'ForkBomb') }, { type: 'mark', lane: 0 }).state
    assert.equal(refused(half, { type: 'place', lane: 0 }), 'The cost is not paid')
    assert.equal(refused(half, { type: 'mark', lane: 0 }), 'Already marked')
    assert.equal(
      cardAt(play(half, { type: 'mark', lane: 1 }, { type: 'place', lane: 0 }).state.player.board, 0),
      'ForkBomb',
    )

    // A single card that cost 2 pays for another that costs 2 on its own.
    const trade = table({ hand: ['Documentation'], board: ['ForkBomb'] })
    const { state: after } = play(
      trade,
      { type: 'select', uid: uidOf(trade, 'Documentation') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    assert.equal(cardAt(after.player.board, 0), 'Documentation')
  })

  it('stops marking once the cost is paid', () => {
    const state = table({ hand: ['NullPointer'], board: ['InfiniteLoop', 'HelloWorld'] })
    const paid = play(state, { type: 'select', uid: uidOf(state, 'NullPointer') }, { type: 'mark', lane: 0 }).state
    assert.equal(refused(paid, { type: 'mark', lane: 1 }), 'The cost is already paid')
  })

  it('lets an unmarked card be taken back off the bill', () => {
    const state = table({ hand: ['NullPointer'], board: ['InfiniteLoop', 'HelloWorld'] })
    const { state: after } = play(
      state,
      { type: 'select', uid: uidOf(state, 'NullPointer') },
      { type: 'mark', lane: 0 },
      { type: 'unmark', lane: 0 },
      { type: 'mark', lane: 1 },
      { type: 'place', lane: 1 },
    )
    assert.equal(cardAt(after.player.board, 0), 'InfiniteLoop')
    assert.equal(cardAt(after.player.board, 1), 'NullPointer')
  })

  it('counts Technical Debt as three', () => {
    const state = table({ hand: ['Mainframe'], board: ['InfiniteLoop'] })
    ;(state.player.board[0] as { sigils: string[] }).sigils.push('technical_debt')
    const { state: after } = play(
      state,
      { type: 'select', uid: uidOf(state, 'Mainframe') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    assert.equal(cardAt(after.player.board, 0), 'Mainframe')
  })

  it('lets try/catch survive its sacrifice, so the new card needs another lane', () => {
    const state = table({ hand: ['NullPointer'], board: ['InfiniteLoop'] })
    ;(state.player.board[0] as { sigils: string[] }).sigils.push('try_catch')
    const marked = play(state, { type: 'select', uid: uidOf(state, 'NullPointer') }, { type: 'mark', lane: 0 }).state
    assert.equal(refused(marked, { type: 'place', lane: 0 }), 'That lane is taken')
    const { state: after, events } = play(marked, { type: 'place', lane: 2 })
    assert.equal(cardAt(after.player.board, 0), 'InfiniteLoop')
    assert.ok(events.some((event) => event.type === 'sacrificed' && event.survived))
  })

  it('wipes the opponent’s side when FourOhFour arrives', () => {
    const state = table({
      hand: ['FourOhFour'],
      board: ['InfiniteLoop', 'HelloWorld', 'CronJob', 'CopyPaste'],
      front: ['Mainframe', 'Bug'],
      back: [null, 'ForkBomb', 'Cookie'],
    })
    const { state: after, events } = play(
      state,
      { type: 'select', uid: uidOf(state, 'FourOhFour') },
      { type: 'mark', lane: 0 },
      { type: 'mark', lane: 1 },
      { type: 'mark', lane: 2 },
      { type: 'mark', lane: 3 },
      { type: 'place', lane: 0 },
    )
    assert.ok(after.opponent.front.every((slot) => slot === null))
    assert.ok(after.opponent.back.every((slot) => slot === null))
    const wiped = events.find((event) => event.type === 'wiped')
    assert.equal(wiped?.type === 'wiped' && wiped.uids.length, 4)
  })
})
