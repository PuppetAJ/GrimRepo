import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardAt, play, refused, table, uidOf } from './test-support.ts'
import { card } from '../cards.ts'
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

  it('Deprecated dies after it attacks, and leaves a Boilerplate in its lane', () => {
    const { state, events } = bell(table({ board: ['DestroyEnemyYou'] }))
    assert.equal(hits(events, 'opponent'), 8)
    assert.equal(cardAt(state.player.board, 0), 'Boilerplate')
    assert.ok(events.some((event) => event.type === 'leftBehind' && event.lane === 0))
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
    assert.ok(placed?.sigils.includes('refactor'), 'and Refactor with them')
  })

  it('Refactor is gone for the battle once sacrificed, so a reshuffle never brings it back', () => {
    const start = table({ hand: ['LegacyCode'], board: ['OffCenterDiv'] })
    const div = start.player.board[0]?.source
    const { state } = play(
      start,
      { type: 'select', uid: uidOf(start, 'LegacyCode') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    assert.ok(div !== undefined && state.player.spent?.includes(div))
    // Empty the deck, so the next draw rebuilds it from what's out of play.
    const emptied = { ...state, drawn: false, player: { ...state.player, deck: [] } }
    const { state: drawn } = play(emptied, { type: 'draw', from: 'deck' })
    const back = [...drawn.player.deck, ...drawn.player.hand.map((unit) => unit.source)]
    assert.ok(!back.includes(div), 'Off-Center Div stays out of the rebuilt deck')
  })

  it('Refactor passed on stacks through a chain of sacrifices', () => {
    const start = table({ hand: ['LegacyCode', 'Firewall'], board: ['OffCenterDiv'] })
    const { state } = play(
      start,
      { type: 'select', uid: uidOf(start, 'LegacyCode') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
      { type: 'select', uid: uidOf(start, 'Firewall') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    const placed = state.player.board[0]
    assert.equal(placed?.card, 'Firewall')
    assert.equal(placed?.attack, 2 + 3 + 0)
    assert.equal(placed?.health, 6 + 4 + 6)
  })

  it('a shipped Beta card is worth 2 when sacrificed', () => {
    const start = table({ hand: ['JSONFoorhees'], board: ['ShippedFeature'] })
    const { state } = play(
      start,
      { type: 'select', uid: uidOf(start, 'JSONFoorhees') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    assert.equal(cardAt(state.player.board, 0), 'JSONFoorhees')
  })

  it('Technical Debt pays 3, and tips the scale 1 against the player', () => {
    const start = table({ hand: ['Mainframe'], board: ['LegacyCode'] })
    const { state, events } = play(
      start,
      { type: 'select', uid: uidOf(start, 'Mainframe') },
      { type: 'mark', lane: 0 },
      { type: 'place', lane: 0 },
    )
    assert.equal(cardAt(state.player.board, 0), 'Mainframe')
    assert.equal(state.scale, -1)
    assert.ok(events.some((event) => event.type === 'indebted' && event.amount === 1 && event.scale === -1))
  })

  it("Technical Debt can't be taken on when it would lose the game", () => {
    const start = table({ hand: ['Mainframe'], board: ['LegacyCode'], scale: -23 })
    assert.match(refused(start, { type: 'select', uid: uidOf(start, 'Mainframe') }), /Not enough/)
    const paid = table({
      hand: ['Mainframe'],
      board: ['LegacyCode', 'Boilerplate', 'Boilerplate', 'Boilerplate'],
      scale: -23,
    })
    const { state: picked } = play(paid, { type: 'select', uid: uidOf(paid, 'Mainframe') })
    assert.match(refused(picked, { type: 'mark', lane: 0 }), /debt/)
    const { state } = play(table({ hand: ['Mainframe'], board: ['LegacyCode'], scale: -22 }), {
      type: 'select',
      uid: uidOf(start, 'Mainframe'),
    })
    assert.equal(play(state, { type: 'mark', lane: 0 }).state.summon?.marked.length, 1, 'one short of a loss is fine')
  })
})

describe('the sigils that move cards', () => {
  it('Failover covers the attacked empty lane nearest where it stands, not the first attacked', () => {
    const { state, events } = bell(
      table({ board: [null, null, 'MergeConflict', null], front: ['CopyPaste', null, null, 'CopyPaste'] }),
    )
    assert.equal(state.player.board[3]?.card, 'MergeConflict')
    assert.equal(hits(events, 'player'), 3, 'lane 1, left uncovered, hits the player')
  })

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

  it('Hot Reload brings a card back only once', () => {
    const { state } = bell(table({ board: ['Bug'], front: ['NullPointer'] }))
    const copy = state.player.hand.find((unit) => unit.card === 'Bug')
    assert.ok(copy && !copy.sigils.includes('hot_reload'))
  })

  it('Beta ships as its stronger form after a round on the table', () => {
    const { state, events } = bell(table({ board: ['Prototype'] }))
    assert.ok(events.some((event) => event.type === 'shipped'))
    assert.equal(state.player.board[0]?.card, 'ShippedFeature')
    assert.equal(state.player.board[0]?.attack, 4)
  })

  it('a Prototype ships with the buffs and sigils the run gave it', () => {
    const start = table({ board: ['Prototype'] })
    const prototype = start.player.board[0] as NonNullable<(typeof start.player.board)[0]>
    prototype.attack += 2
    prototype.health += 3
    prototype.maxHealth += 3
    prototype.sigils.push('hotfix')
    const { state } = bell(start)
    const shipped = state.player.board[0]
    assert.equal(shipped?.card, 'ShippedFeature')
    assert.equal(shipped?.attack, 4 + 2)
    assert.equal(shipped?.maxHealth, card('ShippedFeature').health + 3)
    assert.ok(shipped?.sigils.includes('hotfix') && !shipped.sigils.includes('beta'))
  })

  it('Beta on any other card ships it with +3/+3', () => {
    const start = table({ board: ['CopyPaste'] })
    start.player.board[0]?.sigils.push('beta')
    const { state } = bell(start)
    const shipped = state.player.board[0]
    assert.equal(shipped?.card, 'CopyPaste')
    assert.equal(shipped?.attack, 3 + 3)
    assert.ok(shipped && !shipped.sigils.includes('beta'))
  })
})
