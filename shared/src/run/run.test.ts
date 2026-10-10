import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card, EVENT_ONLY, PLAYER_DECK } from '../cards.ts'
import { deckCard } from '../engine/units.ts'
import { Rng } from '../rng.ts'
import { scoreRun } from '../scoring.ts'
import { playRun } from './bot.ts'
import { findNode } from './map.ts'
import {
  applyRun,
  createRun,
  legalRunActions,
  CHOICE_POOLS,
  PACK_SIZE,
  PACKS,
  PICKS,
  REPAIR,
  reachable,
  replayRun,
  STARTER_DECKS,
  UNINSTALL_PRICE,
} from './run.ts'
import { INTEGRITY, type NodeKind, type RunAction, type RunCard, type RunState, type Visit } from './types.ts'

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

const STARTER = STARTER_DECKS['hello-world']?.core as string[]

/** Takes the first card of each starter pack. */
const unpacked = (state: RunState): RunState =>
  state.visit?.kind === 'pack' ? unpacked(step(state, { type: 'take', index: 0 })) : state

/** A fresh run past its first choice, on the Hello, World deck, with a card taken from each pack. */
const started = ({ seed }: { seed: number }) =>
  unpacked(step(createRun({ seed }), { type: 'start', deck: 'hello-world' }))

/** A fresh run standing on a node of the given kind, whatever the map says. */
function at(kind: NodeKind, visit: Visit, seed = 1): RunState {
  const state = started({ seed })
  const node = state.map.rows.flat()[0] as NonNullable<ReturnType<typeof findNode>>
  node.kind = kind
  state.at = node.id
  state.visit = visit
  return state
}

describe('a new run', () => {
  it('starts by choosing a starter deck, then stands on stage one with nothing visited', () => {
    const fresh = createRun({ seed: 9 })
    assert.equal(fresh.visit?.kind, 'start')
    assert.deepEqual(reachable(fresh), [], 'the map waits for the deck')
    assert.equal(refused(fresh, { type: 'start', deck: 'nope' }), 'No such starter deck')
    const opened = step(fresh, { type: 'start', deck: 'hello-world' })
    assert.equal(opened.visit?.kind, 'pack')
    assert.deepEqual(reachable(opened), [], 'the map waits for the packs')
    const state = unpacked(opened)
    assert.deepEqual(
      state.deck.slice(0, STARTER.length).map((entry) => entry.card),
      STARTER,
    )
    assert.equal(state.deck.length, STARTER.length + PACKS)
    assert.equal(state.integrity, INTEGRITY)
    assert.equal(state.stage, 0)
    assert.deepEqual(
      reachable(state),
      (state.map.rows[0] ?? []).map((node) => node.id),
    )
  })

  it('moves only along the map', () => {
    const state = started({ seed: 9 })
    assert.equal(refused(state, { type: 'go', node: '7-0' }), 'That node is not reachable from here')
    const first = reachable(state)[0] as string
    const moved = step(state, { type: 'go', node: first })
    assert.equal(moved.at, first)
    assert.equal(refused(moved, { type: 'go', node: first }), 'Finish this node first')
  })
})

describe('the starter packs', () => {
  /** Each pack's offer, taking the card at `index` from each. */
  const packs = (seed: number, deck: string, index = 0) => {
    let state = step(createRun({ seed }), { type: 'start', deck })
    const offers: string[][] = []
    while (state.visit?.kind === 'pack') {
      offers.push(state.visit.offer)
      state = step(state, { type: 'take', index })
    }
    return { offers, state }
  }

  it("open one after another, three cards each from the deck's pool", () => {
    for (const [id, deck] of Object.entries(STARTER_DECKS))
      for (let seed = 1; seed <= 40; seed++) {
        const { offers } = packs(seed, id)
        assert.equal(offers.length, PACKS)
        for (const offer of offers) {
          assert.equal(offer.length, PACK_SIZE)
          assert.ok(
            offer.every((found) => Object.values(deck.pack).flat().includes(found)),
            offer.join(),
          )
        }
        assert.deepEqual(packs(seed, id).offers, offers, 'the same for a seed')
      }
  })

  it('add only the card taken from each', () => {
    const { offers, state } = packs(3, 'move-fast', 2)
    assert.deepEqual(
      state.deck.slice(-PACKS).map((entry) => entry.card),
      offers.map((offer) => offer[2]),
    )
    assert.equal(state.visit, null)
  })

  it('hold a rare now and then', () => {
    const rares = STARTER_DECKS['move-fast']?.pack.rare ?? []
    const offers = Array.from({ length: 200 }, (_, seed) => packs(seed + 1, 'move-fast').offers).flat(2)
    assert.ok(offers.some((found) => rares.includes(found)))
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

  const offered = (state: RunState) => {
    const cardNode = reachable(state).find((id) => findNode(state.map, id)?.kind === 'card')
    if (!cardNode) return null
    const next = step(state, { type: 'go', node: cardNode })
    return { state: next, offer: next.visit?.kind === 'card' ? next.visit.offer : [] }
  }

  it('offers no rare at first, while the pity offset holds the odds at 0, and never an A tier', () => {
    for (let seed = 0; seed < 100; seed++) {
      const found = offered(started({ seed }))
      if (!found) continue
      assert.equal(found.offer.length, 3)
      assert.ok(
        found.offer.every((id) => [...CHOICE_POOLS.common, ...CHOICE_POOLS.uncommon].includes(id)),
        found.offer.join(', '),
      )
    }
    assert.ok(
      Object.values(CHOICE_POOLS)
        .flat()
        .every((id) => card(id).tier !== 'A'),
    )
  })

  it('offers rares as the pity offset grows, and a rare resets it', () => {
    for (let seed = 0; seed < 20; seed++) {
      const found = offered({ ...started({ seed }), pity: 97 })
      if (!found) continue
      assert.ok(CHOICE_POOLS.rare.includes(found.offer.find((id) => card(id).tier === 'B') ?? ''), found.offer.join())
      assert.ok(found.state.pity < 0, 'reset by the rare, then grown by any commons after it')
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
      assert.equal(twice.deck.find((entry) => entry.id === 1)?.attack, (card(STARTER[0] as string).attack ?? 0) + 2)
      assert.equal(refused(twice, { type: 'buff', card: 1 }), 'The campfire has gone out')
    }
    assert.ok(burned > 30 && burned < 70, `burned ${burned} of 100`)
  })

  it('repairs integrity instead, up to full, and then goes out', () => {
    const worn = { ...fire('attack'), integrity: 9 }
    const repaired = step(worn, { type: 'repair' })
    assert.equal(repaired.integrity, 9 + REPAIR)
    assert.equal(repaired.visit, null)
    assert.equal(step({ ...fire('attack'), integrity: INTEGRITY - 2 }, { type: 'repair' }).integrity, INTEGRITY)
    assert.equal(refused(fire('attack'), { type: 'repair' }), 'Integrity is already full')
    assert.ok(!legalRunActions(fire('attack')).some((action) => action.type === 'repair'))
  })

  it('repairs or warms, never both', () => {
    const state = { ...fire('attack'), integrity: 9 }
    assert.ok(legalRunActions(state).some((action) => action.type === 'repair'))
    const warmed = step(state, { type: 'buff', card: 1 })
    assert.equal(refused(warmed, { type: 'repair' }), 'The campfire is already warming a card')
    assert.ok(!legalRunActions(warmed).some((action) => action.type === 'repair'))
  })
})

describe('integrity', () => {
  it('carries out of a battle, and ends the run when it runs out', () => {
    let state = { ...started({ seed: 4 }), integrity: 1 }
    const node = reachable(state).find((id) => findNode(state.map, id)?.kind === 'battle') ?? reachable(state)[0]
    const found = findNode(state.map, node as string)
    assert.ok(found)
    found.kind = 'battle'
    found.encounter = 'localhost-hello'
    state = step(state, { type: 'go', node: found.id })
    assert.ok(state.visit?.kind === 'battle')
    assert.equal(state.visit.game.integrity?.left, 1)
    // A Cron Job facing a Sandbox is destroyed on the bell.
    const game = state.visit.game
    game.drawn = true
    game.player.board[0] = { uid: 900, card: 'CronJob', attack: 1, health: 2, maxHealth: 2, sigils: [] }
    game.opponent.front[0] = { uid: 901, card: 'Sandbox', attack: 2, health: 5, maxHealth: 5, sigils: [] }
    const result = applyRun(state, { type: 'play', action: { type: 'ringBell' } })
    assert.ok(result.ok)
    assert.equal(result.state.integrity, 0)
    assert.equal(result.state.status, 'lost')
    assert.ok(result.events.some((event) => event.type === 'runOver' && event.integrity))
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

  it('let a card that gained a sigil, from the stones or an event, give one, but never take a second', () => {
    const state = at('stones', { kind: 'stones', node: '0-0' })
    state.deck[0]?.sigils.push('bypass')
    state.deck[1]?.sigils.push('hotfix')
    ;(state.deck[1] as { added: string | null }).added = 'hotfix'
    assert.equal(
      refused(state, { type: 'transfer', from: 1, to: 2, sigil: 'bypass' }),
      'That card cannot take this sigil',
    )
    const after = step(state, { type: 'transfer', from: 2, to: 1, sigil: 'hotfix' })
    assert.ok(!after.deck.some((entry) => entry.id === 2), 'the giver is used up')
    assert.equal(after.deck.find((entry) => entry.id === 1)?.added, 'hotfix')
  })
})

describe('fork and broadcast', () => {
  it('never share a card, since one of them would do nothing', () => {
    const state = at('stones', { kind: 'stones', node: '0-0' })
    state.deck[0]?.sigils.push('fork')
    state.deck[1]?.sigils.push('broadcast')
    assert.equal(
      refused(state, { type: 'transfer', from: 1, to: 2, sigil: 'fork' }),
      'That card cannot take this sigil',
    )
    assert.equal(
      refused(state, { type: 'transfer', from: 2, to: 1, sigil: 'broadcast' }),
      'That card cannot take this sigil',
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

  it('can fork a card, buffs and sigils and all, as a new card', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'fork-repo' })
    for (const entry of state.deck) entry.attack += 5
    const after = step(state, { type: 'choose', option: 0 })
    const copy = after.deck.at(-1)
    assert.equal(after.deck.length, state.deck.length + 1)
    assert.ok(copy && copy.attack === card(copy.card).attack + 5, 'the copy kept its buff')
    assert.equal(new Set(after.deck.map((entry) => entry.id)).size, after.deck.length, 'with its own id')
  })

  it('the linter deletes one sigil from the card the player picks', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'linter' })
    const opened = step(state, { type: 'choose', option: 0 })
    assert.equal(opened.visit?.kind, 'lint')
    const target = opened.deck.find((entry) => entry.sigils.length) as (typeof opened.deck)[number]
    const sigil = target.sigils[0] as NonNullable<(typeof target.sigils)[number]>
    const after = step(opened, { type: 'strip', card: target.id, sigil })
    assert.ok(!after.deck.find((entry) => entry.id === target.id)?.sigils.includes(sigil))
    assert.equal(after.visit, null)
    assert.equal(
      refused(opened, { type: 'strip', card: target.id, sigil: 'segfault' }),
      'That card does not have that sigil',
    )
    assert.equal(step(opened, { type: 'leave' }).visit, null, 'and can be left without fixing anything')
  })

  it('is the only way to the event-only cards', () => {
    const hire = at('event', { kind: 'event', node: '0-0', event: 'code-review' })
    const after = step(hire, { type: 'choose', option: 0 })
    assert.equal(after.deck.at(-1)?.card, 'SeniorDev')
    assert.equal(after.deck.length, hire.deck.length, 'a card made room for it')
    for (const id of EVENT_ONLY) assert.ok(!PLAYER_DECK.includes(id), `${id} is never dealt or offered`)
  })
})

describe('a shop', () => {
  const shopAt = (bytes: number) => {
    const state = at('shop', {
      kind: 'shop',
      node: '0-0',
      offer: [
        { card: 'CopyPaste', price: 3 },
        { card: 'Firewall', price: 4 },
        { card: 'Mainframe', price: 10 },
      ],
      sold: [],
      tools: [
        { id: 'hammer', price: 6 },
        { id: 'scissors', price: 10 },
      ],
      toolsSold: [],
    })
    return { ...state, bytes }
  }

  it('sells cards for bytes, several in one visit, each only once', () => {
    const state = shopAt(7)
    const once = step(state, { type: 'buy', index: 0 })
    assert.equal(once.bytes, 4)
    assert.equal(once.deck.at(-1)?.card, 'CopyPaste')
    assert.equal(refused(once, { type: 'buy', index: 0 }), 'That card is sold')
    const twice = step(once, { type: 'buy', index: 1 })
    assert.equal(twice.bytes, 0)
    assert.equal(refused(twice, { type: 'buy', index: 2 }), 'Not enough bytes')
    assert.equal(step(twice, { type: 'leave' }).visit, null)
  })

  it('appears once on every stage', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const shops = createRun({ seed })
        .map.rows.flat()
        .filter((node) => node.kind === 'shop')
      assert.equal(shops.length, 1, `seed ${seed}`)
    }
  })
})

describe('the merge request', () => {
  it('folds two copies of a card into one, adding their stats at the same cost', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'merge-request' })
    const copy = { ...(state.deck[0] as RunCard), id: 99, attack: 1, sigils: ['bypass' as const] }
    state.deck.push(copy)
    const opened = step(state, { type: 'choose', option: 0 })
    assert.equal(opened.visit?.kind, 'fuse')
    const kept = opened.deck[0] as RunCard
    const merged = step(opened, { type: 'fuse', card: kept.id })
    const result = merged.deck.find((entry) => entry.id === kept.id)
    assert.equal(merged.deck.length, opened.deck.length - 1)
    assert.equal(result?.attack, kept.attack + 1)
    assert.equal(result?.health, kept.health + copy.health)
    assert.ok(result?.sigils.includes('bypass'), "the copy's sigil joins")
    assert.equal(merged.visit, null)
  })

  it('merges with the copy named, when there are more than two', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'merge-request' })
    const first = state.deck[0] as RunCard
    state.deck.push({ ...first, id: 98, attack: 1 }, { ...first, id: 99, attack: 5 })
    const opened = step(state, { type: 'choose', option: 0 })
    const merged = step(opened, { type: 'fuse', card: first.id, with: 99 })
    assert.equal(merged.deck.find((entry) => entry.id === first.id)?.attack, first.attack + 5)
    assert.ok(merged.deck.some((entry) => entry.id === 98))
    assert.ok(!merged.deck.some((entry) => entry.id === 99))
    assert.ok(!applyRun(opened, { type: 'fuse', card: first.id, with: first.id }).ok)
  })

  it('opens only when the deck holds a duplicate', () => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'merge-request' })
    assert.equal(step(state, { type: 'choose', option: 0 }).visit, null)
  })
})

describe('the code review', () => {
  // Three cards with 8 health and a sigil each: stability always fails, coverage always passes.
  const review = (option: number) => {
    const state = at('event', { kind: 'event', node: '0-0', event: 'review-trial' })
    state.deck = ['HelloWorld', 'CronJob', 'MergeConflict'].map((id, index) => ({
      id: index + 1,
      added: null,
      ...deckCard(id),
    }))
    const result = applyRun(state, {
      type: 'choose',
      option,
    })
    assert.ok(result.ok)
    const trial = result.events.find((event) => event.type === 'trialled')
    const rare = result.events.some(
      (event) => event.type === 'added' && ['A', 'B'].includes(card(event.card.card).tier),
    )
    return { trial, rare }
  }

  it('draws three cards and judges their total against the bar', () => {
    const { trial, rare } = review(1)
    assert.ok(trial?.type === 'trialled' && trial.cards.length === 3)
    assert.equal(trial.total, 8)
    assert.equal(trial.passed, false)
    assert.equal(rare, false, 'a failed review gives nothing')
  })

  it('hands over a rare when they meet it', () => {
    const { trial, rare } = review(2)
    assert.ok(trial?.type === 'trialled' && trial.passed)
    assert.equal(rare, true)
  })
})

describe("a shop's tools", () => {
  it('sells two different ones, each once, for bytes, while a slot is free', () => {
    const state = at('shop', {
      kind: 'shop',
      node: '0-0',
      offer: [],
      sold: [],
      tools: [
        { id: 'hammer', price: 6 },
        { id: 'scissors', price: 10 },
      ],
      toolsSold: [],
    })
    const rich = { ...state, bytes: 20 }
    const one = step(rich, { type: 'buyItem', index: 1 })
    assert.deepEqual([one.items, one.bytes], [['scissors'], 10])
    assert.equal(refused(one, { type: 'buyItem', index: 1 }), 'That tool is sold')
    const both = step(one, { type: 'buyItem', index: 0 })
    assert.deepEqual(both.items, ['scissors', 'hammer'])
    assert.equal(refused({ ...state, bytes: 5 }, { type: 'buyItem', index: 0 }), 'Not enough bytes')
    const full = { ...rich, items: ['hook', 'bottle', 'pliers'] as RunState['items'] }
    assert.ok(!legalRunActions(full).some((action) => action.type === 'buyItem'))
  })

  it('are two different tools at every shop', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let state = createRun({ seed })
      state = unpacked(step(state, { type: 'start', deck: 'hello-world' }))
      const node = state.map.rows[0]?.[0]
      assert.ok(node)
      node.kind = 'shop'
      const visit = step(state, { type: 'go', node: node.id }).visit
      assert.ok(visit?.kind === 'shop')
      assert.equal(new Set(visit.tools.map((tool) => tool.id)).size, 2)
    }
  })
})

describe('uninstalling at a shop', () => {
  it('removes a chosen card for bytes, once a visit', () => {
    const state = {
      ...at('shop', { kind: 'shop', node: '0-0', offer: [], sold: [], tools: [], toolsSold: [] }),
      bytes: 9,
    }
    const target = state.deck[1] as RunCard
    const after = step(state, { type: 'uninstall', card: target.id })
    assert.ok(!after.deck.some((entry) => entry.id === target.id))
    assert.equal(after.bytes, 9 - UNINSTALL_PRICE)
    assert.equal(
      refused(after, { type: 'uninstall', card: (after.deck[0] as RunCard).id }),
      'Only one uninstall a visit',
    )
    const poor = { ...state, bytes: UNINSTALL_PRICE - 1 }
    assert.equal(refused(poor, { type: 'uninstall', card: target.id }), 'Not enough bytes')
  })
})

describe('items in a run', () => {
  it('an item node gives one of three, and a full kit gives one up for it', () => {
    const state = at('item', { kind: 'item', node: '0-0', offer: ['hammer', 'pliers', 'hourglass'] })
    const one = step(state, { type: 'pickItem', index: 2 })
    assert.deepEqual(one.items, ['hourglass'])
    const full = { ...state, items: ['hook', 'bottle', 'pliers'] as RunState['items'] }
    assert.equal(refused(full, { type: 'pickItem', index: 0 }), 'Choose an item to give up')
    assert.deepEqual(step(full, { type: 'pickItem', index: 0, drop: 1 }).items, ['hook', 'pliers', 'hammer'])
  })

  it('go into a battle, and the ones not used come back out', () => {
    const state = { ...started({ seed: 4 }), items: ['hourglass', 'hook'] as RunState['items'] }
    const node = reachable(state).find((id) => findNode(state.map, id)) as string
    const target = findNode(state.map, node) as NonNullable<ReturnType<typeof findNode>>
    target.kind = 'battle'
    target.encounter = 'localhost-hello'
    const inBattle = step(state, { type: 'go', node })
    assert.ok(inBattle.visit?.kind === 'battle')
    assert.deepEqual(inBattle.visit.game.items, ['hourglass', 'hook'])
  })
})

describe('a face-down card choice', () => {
  it('turns over three cards with the trait picked, and adds the one taken', () => {
    const state = at('card', { kind: 'blind', node: '0-0', picks: ['free', 'sigil', 'sturdy'] })
    const turned = step(state, { type: 'take', index: 2 })
    assert.ok(turned.visit?.kind === 'blind' && turned.visit.revealed)
    const offer = turned.visit.revealed.offer
    assert.equal(offer.length, 3)
    for (const id of offer) assert.ok(PICKS.sturdy.fits(id), id)
    assert.equal(turned.deck.length, state.deck.length)
    const after = step(turned, { type: 'take', index: 1 })
    assert.equal(after.deck.at(-1)?.card, offer[1])
    assert.equal(after.visit, null)
    assert.equal(refused(state, { type: 'take', index: 3 }), 'No such choice')
    assert.equal(refused(turned, { type: 'take', index: 3 }), 'No such card on offer')
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
    const state = battleAt(started({ seed: 4 }), 'battle')
    assert.ok(state.visit?.kind === 'battle')
    assert.equal(state.visit.game.player.library.length, STARTER.length + PACKS)
    assert.deepEqual(state.visit.game.integrity, { left: INTEGRITY, max: INTEGRITY })
    const won = win(state)
    assert.equal(won.record.battles, 1)
    assert.equal(won.record.overkill, 13 + 23 - 24)
    assert.deepEqual(legalRunActions(won), [{ type: 'leave' }])
    assert.equal(step(won, { type: 'leave' }).visit, null)
  })

  it('end the run when one is lost', () => {
    const state = battleAt(started({ seed: 4 }), 'battle')
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
    const won = step(win(battleAt(started({ seed: 4 }), 'boss')), { type: 'leave' })
    assert.equal(won.record.bosses, 1)
    assert.ok(won.visit?.kind === 'reward')
    assert.ok(won.visit.offer.every((id) => ['A', 'B'].includes(card(id).tier)))
    const next = step(won, { type: 'take', index: 0 })
    assert.equal(next.stage, 1)
    assert.equal(next.at, null)
    assert.equal(next.map.stage, 1)
  })

  it('beating the last boss wins the run', () => {
    const state = started({ seed: 4 })
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
  // Measured at about 48% past the first boss and 6% cleared, over 600 greedy runs, with integrity and the comebacks.
  it('lets a simple bot clear stage one about half the time, and rarely the whole run', () => {
    let firstBoss = 0
    let cleared = 0
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = playRun(createRun({ seed }), step)
      if (state.record.bosses >= 1) firstBoss += 1
      if (state.status === 'won') cleared += 1
    }
    assert.ok(firstBoss > 80, `${firstBoss} of 200 beat the first boss`)
    assert.ok(cleared < 30, `${cleared} of 200 cleared the run`)
  })
})
