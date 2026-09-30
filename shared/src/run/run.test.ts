import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card } from '../cards.ts'
import { Rng } from '../rng.ts'
import { scoreRun } from '../scoring.ts'
import { playRun } from './bot.ts'
import { findNode } from './map.ts'
import { applyRun, createRun, legalRunActions, reachable, replayRun, STARTER_DECK } from './run.ts'
import type { NodeKind, RunAction, RunState, Visit } from './types.ts'

const step = (state: RunState, action: RunAction) => {
  const result = applyRun(state, action)
  if (!result.ok) throw new Error(`${JSON.stringify(action)}: ${result.reason}`)
  return result.state
}

const refused = (state: RunState, action: RunAction) => {
  const result = applyRun(state, action)
  assert.ok(!result.ok, `${JSON.stringify(action)} should have been refused`)
  return result.reason
}

/** A fresh run standing on a node of the given kind, whatever the map says. */
function at(kind: NodeKind, visit: Visit, seed = 1): RunState {
  const state = createRun({ seed })
  const node = state.map.rows.flat()[0] as NonNullable<ReturnType<typeof findNode>>
  node.kind = kind
  state.at = node.id
  state.visit = visit
  return state
}

describe('a new run', () => {
  it('starts on stage one with the starter deck and nothing visited', () => {
    const state = createRun({ seed: 9 })
    assert.deepEqual(
      state.deck.map((entry) => entry.card),
      STARTER_DECK,
    )
    assert.equal(state.stage, 0)
    assert.deepEqual(
      reachable(state),
      (state.map.rows[0] ?? []).map((node) => node.id),
    )
  })

  it('moves only along the map', () => {
    const state = createRun({ seed: 9 })
    assert.equal(refused(state, { type: 'go', node: '7-0' }), 'That node is not reachable from here')
    const first = reachable(state)[0] as string
    const moved = step(state, { type: 'go', node: first })
    assert.equal(moved.at, first)
    assert.equal(refused(moved, { type: 'go', node: first }), 'Finish this node first')
  })
})

describe('a card choice', () => {
  it('adds one of three common cards to the deck', () => {
    const state = at('card', { kind: 'card', node: '0-0', offer: ['Bug', 'Cookie', 'HelloWorld'] })
    const after = step(state, { type: 'take', index: 1 })
    assert.equal(after.deck.at(-1)?.card, 'Cookie')
    assert.equal(after.visit, null)
    assert.equal(refused(state, { type: 'take', index: 3 }), 'No such card on offer')
  })

  it('never offers a rare', () => {
    for (let seed = 0; seed < 100; seed++) {
      let state = createRun({ seed })
      const cardNode = reachable(state).find((id) => findNode(state.map, id)?.kind === 'card')
      if (!cardNode) continue
      state = step(state, { type: 'go', node: cardNode })
      const offer = state.visit?.kind === 'card' ? state.visit.offer : []
      assert.equal(offer.length, 3)
      assert.ok(
        offer.every((id) => !['A', 'B'].includes(card(id).tier)),
        offer.join(', '),
      )
    }
  })
})

describe('a campfire', () => {
  const fire = (boost: 'attack' | 'health', seed = 1) =>
    at('campfire', { kind: 'campfire', node: '0-0', boost, card: null, buffs: 0 }, seed)

  it('adds 1 attack or 2 health, as the fire offers', () => {
    const state = fire('attack')
    const target = state.deck[0]?.id as number
    const hotter = step(state, { type: 'buff', card: target })
    assert.equal(hotter.deck[0]?.attack, (state.deck[0]?.attack ?? 0) + 1)
    const tougher = step(fire('health'), { type: 'buff', card: target })
    assert.equal(tougher.deck[0]?.health, (state.deck[0]?.health ?? 0) + 2)
  })

  it('takes only the same card back, at most twice, and sometimes burns it', () => {
    let burned = 0
    for (let seed = 0; seed < 100; seed++) {
      const once = step(fire('attack', seed), { type: 'buff', card: 1 })
      assert.equal(refused(once, { type: 'buff', card: 2 }), 'Only the card already buffed can go back in')
      const twice = step(once, { type: 'buff', card: 1 })
      if (!twice.deck.some((entry) => entry.id === 1)) {
        burned += 1
        continue
      }
      assert.equal(
        twice.deck.find((entry) => entry.id === 1)?.attack,
        (card(STARTER_DECK[0] as string).attack ?? 0) + 2,
      )
      assert.equal(refused(twice, { type: 'buff', card: 1 }), 'The campfire has gone out')
    }
    assert.ok(burned > 30 && burned < 70, `burned ${burned} of 100`)
  })
})

describe('sigil stones', () => {
  it('move a sigil to another card and use up the first', () => {
    const state = at('stones', { kind: 'stones', node: '0-0' })
    state.deck[0]?.sigils.push('bypass')
    const after = step(state, { type: 'transfer', from: 1, to: 2, sigil: 'bypass' })
    assert.ok(!after.deck.some((entry) => entry.id === 1))
    const gained = after.deck.find((entry) => entry.id === 2)
    assert.ok(gained?.sigils.includes('bypass') && gained.added === 'bypass')
  })

  it('refuse a card that already gained a sigil, on either side', () => {
    const state = at('stones', { kind: 'stones', node: '0-0' })
    state.deck[0]?.sigils.push('bypass')
    state.deck[1]?.sigils.push('hotfix')
    ;(state.deck[1] as { added: string | null }).added = 'hotfix'
    assert.equal(
      refused(state, { type: 'transfer', from: 1, to: 2, sigil: 'bypass' }),
      'That card cannot take this sigil',
    )
    assert.equal(
      refused(state, { type: 'transfer', from: 2, to: 1, sigil: 'hotfix' }),
      'A card that already gained a sigil cannot give one',
    )
  })
})

describe('an event', () => {
  it('applies the chosen option', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'stack-overflow' })
    assert.equal(step(state, { type: 'choose', option: 1 }).deck.at(-1)?.card, 'CopyPaste')
    assert.equal(refused(state, { type: 'choose', option: 2 }), 'No such choice')
  })

  it('adds a sigil only to a card that has room for it', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'cors' })
    const after = step(state, { type: 'choose', option: 0 })
    const gained = after.deck.filter((entry) => entry.added === 'bypass')
    assert.equal(gained.length, 1)
  })
})

describe('battles', () => {
  const battleAt = (state: RunState, kind: 'battle' | 'boss') => {
    const node = state.map.rows.flat().find((candidate) => candidate.kind === kind) as NonNullable<
      ReturnType<typeof findNode>
    >
    state.at = null
    state.map.rows[0] = [{ ...node, row: 0, next: node.next }]
    return step(state, { type: 'go', node: node.id })
  }

  const win = (state: RunState) => {
    const visit = state.visit
    assert.ok(visit?.kind === 'battle')
    visit.game.drawn = true
    visit.game.scale = 23
    visit.game.opponent.front.fill(null)
    visit.game.opponent.phase = visit.game.opponent.encounter?.endsWith('boss') ? 1 : 0
    visit.game.player.board[0] = { uid: 999, card: 'Mainframe', attack: 13, health: 13, maxHealth: 13, sigils: [] }
    return step(state, { type: 'play', action: { type: 'ringBell' } })
  }

  it('deal the run’s deck, and a won one waits for the player to leave', () => {
    const state = battleAt(createRun({ seed: 4 }), 'battle')
    assert.ok(state.visit?.kind === 'battle')
    assert.equal(state.visit.game.player.library.length, STARTER_DECK.length)
    const won = win(state)
    assert.equal(won.record.battles, 1)
    assert.equal(won.record.overkill, 13 + 23 - 24)
    assert.deepEqual(legalRunActions(won), [{ type: 'leave' }])
    assert.equal(step(won, { type: 'leave' }).visit, null)
  })

  it('end the run when one is lost', () => {
    const state = battleAt(createRun({ seed: 4 }), 'battle')
    assert.ok(state.visit?.kind === 'battle')
    state.visit.game.drawn = true
    state.visit.game.scale = -23
    state.visit.game.opponent.front[0] = {
      uid: 999,
      card: 'Mainframe',
      attack: 13,
      health: 13,
      maxHealth: 13,
      sigils: [],
    }
    state.visit.game.player.board.fill(null)
    const lost = step(state, { type: 'play', action: { type: 'ringBell' } })
    assert.equal(lost.status, 'lost')
    assert.deepEqual(legalRunActions(lost), [])
  })

  it('a beaten boss offers a rare, then the next stage', () => {
    const won = step(win(battleAt(createRun({ seed: 4 }), 'boss')), { type: 'leave' })
    assert.equal(won.record.bosses, 1)
    assert.ok(won.visit?.kind === 'reward')
    assert.ok(won.visit.offer.every((id) => ['A', 'B'].includes(card(id).tier)))
    const next = step(won, { type: 'take', index: 0 })
    assert.equal(next.stage, 1)
    assert.equal(next.at, null)
    assert.equal(next.map.stage, 1)
  })

  it('beating the last boss wins the run', () => {
    const state = createRun({ seed: 4 })
    state.stage = 2
    const won = win(battleAt(state, 'boss'))
    assert.equal(won.status, 'won')
    assert.deepEqual(legalRunActions(won), [])
  })
})

describe('a recorded run', () => {
  it('replays to exactly the same end from its seed and actions', () => {
    const { state, actions } = playRun(createRun({ seed: 2026 }), step)
    const again = replayRun(2026, actions)
    assert.ok(again.ok)
    assert.deepEqual(again.state, state)
  })

  it('is invalid if any step breaks the rules', () => {
    const { actions } = playRun(createRun({ seed: 2026 }), step)
    const forged: RunAction[] = [...actions.slice(0, 3), { type: 'take', index: 0 }, ...actions.slice(3)]
    assert.ok(!replayRun(2026, forged).ok)
  })

  it('scores battles, bosses, the clear and overkill', () => {
    assert.equal(scoreRun({ battles: 9, bosses: 3, overkill: 10 }, true), 900 + 4500 + 2000 + 200)
    assert.equal(scoreRun({ battles: 1, bosses: 0, overkill: 0 }, false), 100)
  })
})

describe('two hundred random runs', () => {
  it('all end, take only legal actions, and never lose track of a card', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Rng(seed * 7919)
      let state = createRun({ seed })
      let moves = 0
      while (state.status === 'playing') {
        const legal = legalRunActions(state)
        assert.ok(legal.length > 0, `seed ${seed}: stuck`)
        // Ring often so random play can't wander a battle forever.
        const bell = legal.find((action) => action.type === 'play' && action.action.type === 'ringBell')
        state = step(state, bell && rng.float() < 0.3 ? bell : rng.pick(legal))
        moves += 1
        assert.ok(moves < 100_000, `seed ${seed} never ended`)
        const ids = state.deck.map((entry) => entry.id)
        assert.equal(new Set(ids).size, ids.length)
        assert.ok(state.deck.length >= 1)
        assert.ok(state.deck.every((entry) => entry.sigils.length <= 3))
      }
    }
  })
})

describe('the run’s balance', () => {
  // Measured at about 77% past the first boss and 9% cleared, over 300 greedy runs.
  it('lets a simple bot clear stage one more often than not, and rarely the whole run', () => {
    let firstBoss = 0
    let cleared = 0
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = playRun(createRun({ seed }), step)
      if (state.record.bosses >= 1) firstBoss += 1
      if (state.status === 'won') cleared += 1
    }
    assert.ok(firstBoss > 100, `${firstBoss} of 200 beat the first boss`)
    assert.ok(cleared < 60, `${cleared} of 200 cleared the run`)
  })
})
