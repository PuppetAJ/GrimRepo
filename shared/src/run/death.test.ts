import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card, deathCardId, parseDeathCard, type SigilId } from '../cards.ts'
import { encounter } from '../encounters.ts'
import { createGame } from '../engine/game.ts'
import { queuePlan } from '../engine/opponent.ts'
import type { GameEvent } from '../engine/types.ts'
import { makeUnit, worthOf } from '../engine/units.ts'
import { Rng } from '../rng.ts'
import { DEATH_SKIP_BONUS, scoreRun } from '../scoring.ts'
import {
  buildDeathCard,
  deathCost,
  deathCostHand,
  deathParts,
  deathSigilHand,
  deathSkipBonus,
  deathStatsHand,
  rivalAllowed,
} from './death.ts'
import { applyRun, createRun, legalRunActions, replayRun } from './run.ts'
import type { RunAction, RunCard, RunState } from './types.ts'

const step = (state: RunState, action: RunAction) => {
  const result = applyRun(state, action)
  if (!result.ok) throw new Error(`${JSON.stringify(action)}: ${result.reason}`)
  return result.state
}

const entry = (id: number, cardId: string, changes: Partial<RunCard> = {}): RunCard => {
  const def = card(cardId)
  return { id, card: cardId, attack: def.attack, health: def.health, sigils: [...def.sigils], added: null, ...changes }
}

const DEATH = deathCardId({ name: 'Old Faithful', cost: 1, attack: 4, health: 4, art: 'Cookie', sigils: ['retry'] })
const RIVAL = deathCardId({ name: 'Stranger', cost: 1, attack: 3, health: 3, art: 'Watchdog', sigils: [] })

/** A run with a death card, its first node made a card choice and visited. */
function firstCardChoice(state: RunState): RunState {
  const node = state.map.rows[0]?.[0]
  assert.ok(node)
  node.kind = 'card'
  delete node.blind
  return step(state, { type: 'go', node: node.id })
}

describe('a death card id', () => {
  it('reads back as the card it describes, with the art of another', () => {
    const def = card(DEATH)
    assert.deepEqual(
      { name: def.name, cost: def.cost, attack: def.attack, health: def.health, sigils: def.sigils, art: def.art },
      { name: 'Old Faithful', cost: 1, attack: 4, health: 4, sigils: ['retry'], art: 'Cookie' },
    )
    assert.equal(def.tier, card('Cookie').tier)
  })

  it('is refused when forged or malformed', () => {
    for (const id of [
      'death:1:4:4:Cookie:retry',
      'death:1:4:4:NoSuchCard:retry:Name',
      'death:1:4:4:Cookie:flying:Name',
      'death:-1:4:4:Cookie::Name',
      `death:1:4:4:${DEATH}::Name`,
      'death:1:4:4:Cookie::%3Cscript%3E',
      'death:1:4:4:Cookie::A%20name%20far%20too%20long%20to%20fit',
      'death:01:4:4:Cookie::Name',
    ]) {
      assert.equal(parseDeathCard(id), null, id)
      assert.throws(() => card(id))
    }
  })
})

describe('building a death card', () => {
  const deck = [
    entry(1, 'HelloWorld'),
    entry(2, 'Mainframe', { attack: 15 }),
    entry(3, 'NullPointer'),
    entry(4, 'Firewall'),
    entry(5, 'Cookie'),
    entry(6, 'CronJob'),
  ]
  const lost = (rng = 7, cards = deck): RunState => ({ ...createRun({ seed: 3 }), rng, deck: cards })
  const has = (hand: RunCard[], id: number) => hand.some((part) => part.id === id)
  /** A lost run that deals this cost card, this stats card for it, and this sigil card, found by trying its random state. */
  function dealing(cost: number, stats: number, sigils?: number, cards = deck): RunState {
    for (let rng = 1; rng < 50_000; rng++) {
      const state = lost(rng, cards)
      if (
        has(deathCostHand(state), cost) &&
        has(deathStatsHand(state, cost), stats) &&
        (sigils === undefined || has(deathSigilHand(state, cost, stats), sigils))
      )
        return state
    }
    throw new Error('No deal matched')
  }
  const firstSigils = (state: RunState, cost: number, stats: number) =>
    (deathSigilHand(state, cost, stats)[0] as RunCard).id

  it('deals the cost hand first, then a stats hand for the cost picked, the same every replay', () => {
    const state = lost()
    const costs = deathCostHand(state)
    assert.equal(costs.length, 3)
    assert.deepEqual(deathCostHand(lost()), costs)
    const first = costs[0] as RunCard
    assert.deepEqual(deathStatsHand(lost(), first.id), deathStatsHand(state, first.id))
    assert.deepEqual(deathStatsHand(state, 999), [], 'nothing for a cost card not dealt')
  })

  it('deals stats only from cards within one cost of the cost card', () => {
    for (let rng = 1; rng < 200; rng++) {
      const state = lost(rng)
      for (const costCard of deathCostHand(state))
        for (const statsCard of deathStatsHand(state, costCard.id))
          assert.ok(Math.abs(card(statsCard.card).cost - card(costCard.card).cost) <= 1)
    }
  })

  it('takes the cost from one, the stats and art from another, and every sigil of a third', () => {
    const state = dealing(4, 3, 1)
    const built = buildDeathCard(state, { cost: 4, stats: 3, sigils: 1, name: 'Grim  Ping ' })
    assert.ok(built.ok)
    const def = card(built.id)
    assert.deepEqual(
      [def.name, def.cost, def.attack, def.health, def.art, def.sigils],
      ['Grim Ping', 1, 4, 2, 'NullPointer', ['broadcast']],
    )
    assert.equal(deathSigilHand(state, 4, 3).length, 3)
    assert.deepEqual(deathSigilHand(lost(state.rng), 4, 3), deathSigilHand(state, 4, 3), 'the same hand every replay')
  })

  it('keeps the buffs the stats card gained in the run', () => {
    const state = dealing(2, 2)
    const built = buildDeathCard(state, { cost: 2, stats: 2, sigils: firstSigils(state, 2, 2), name: 'Big Iron' })
    assert.ok(built.ok)
    assert.equal(card(built.id).attack, 15)
  })

  it('refuses a card from outside its hand, and a bad name', () => {
    const state = dealing(4, 3)
    const sigils = firstSigils(state, 4, 3)
    const outside = deck.find((part) => !has(deathStatsHand(state, 4), part.id)) as RunCard
    assert.ok(!buildDeathCard(state, { cost: 4, stats: outside.id, sigils, name: 'Nope' }).ok)
    const notDealt = deck.find((part) => !has(deathSigilHand(state, 4, 3), part.id)) as RunCard
    assert.ok(!buildDeathCard(state, { cost: 4, stats: 3, sigils: notDealt.id, name: 'Nope' }).ok)
    for (const name of ['', '   ', 'Seventeen chars!!', '<b>', ' -lead'])
      assert.ok(!buildDeathCard(state, { cost: 4, stats: 3, sigils, name }).ok, name)
  })

  it('costs at most one less than the stats card, and something if that card did', () => {
    // A free card's cost can't put a 3-cost card's stats into play for nothing.
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'Mainframe')), 2)
    assert.equal(deathCost(entry(0, 'Mainframe'), entry(0, 'HelloWorld')), 3)
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'CronJob')), 0)
    // Free cards with 1-cost stats doubled the bot's score, so a card that cost something stays at 1 or more.
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'Firewall')), 1)
  })

  it('never deals a death card as a part, so costs cannot be shaved run after run', () => {
    const withDeath = [...deck, entry(9, DEATH)]
    assert.ok(!deathParts(withDeath).some((part) => part.id === 9))
    for (let rng = 1; rng < 300; rng++) {
      const state = lost(rng, withDeath)
      const costs = deathCostHand(state)
      assert.ok(!has(costs, 9))
      for (const costCard of costs) {
        assert.ok(!has(deathStatsHand(state, costCard.id), 9))
        for (const statsCard of deathStatsHand(state, costCard.id))
          assert.ok(!has(deathSigilHand(state, costCard.id, statsCard.id), 9))
      }
    }
  })
})

describe('leaving a death card out', () => {
  const made = (cost: number, attack: number, health: number, sigils: SigilId[] = []) =>
    deathCardId({ name: 'Rated', cost, attack, health, art: 'Cookie', sigils })

  it('earns more the stronger the card, so a weak one left out earns nothing', () => {
    assert.equal(deathSkipBonus(made(0, 1, 1)), 1)
    assert.equal(deathSkipBonus(made(2, 15, 17, ['retry'])), DEATH_SKIP_BONUS)
    const middling = deathSkipBonus(made(1, 2, 6, ['retry']))
    assert.ok(middling > 1 && middling < DEATH_SKIP_BONUS, String(middling))
  })

  it('multiplies the score by that bonus', () => {
    const record = { battles: 4, bosses: 1, overkill: 5 }
    assert.equal(scoreRun(record, false, 1.2), Math.round(scoreRun(record, false) * 1.2))
  })
})

describe('a run with a death card', () => {
  const start = (skipDeath?: boolean) =>
    step(createRun({ seed: 5, death: DEATH }), {
      type: 'start',
      deck: 'hello-world',
      ...(skipDeath ? { skipDeath } : {}),
    })

  it('can start with or without it', () => {
    const actions = legalRunActions(createRun({ seed: 5, death: DEATH }))
    assert.ok(actions.some((action) => action.type === 'start' && action.skipDeath))
    assert.ok(!legalRunActions(createRun({ seed: 5 })).some((action) => action.type === 'start' && action.skipDeath))
    assert.ok(!applyRun(createRun({ seed: 5 }), { type: 'start', deck: 'hello-world', skipDeath: true }).ok)
  })

  it('offers it once, as one of three at the first card choice, and it plays from the deck', () => {
    const at = firstCardChoice(start())
    assert.ok(at.visit?.kind === 'card' && at.visit.offer.includes(DEATH))
    assert.equal(at.visit.offer.length, 3)
    const index = at.visit.offer.indexOf(DEATH)
    const took = step(at, { type: 'take', index })
    assert.ok(took.deck.some((part) => part.card === DEATH))
    // Never again that run.
    const again = firstCardChoice({ ...structuredClone(took), at: null })
    assert.ok(again.visit?.kind === 'card' && !again.visit.offer.includes(DEATH))
  })

  it('is never offered once left out', () => {
    const at = firstCardChoice(start(true))
    assert.ok(at.visit?.kind === 'card' && !at.visit.offer.includes(DEATH))
  })

  it('replays the same with the same cards dealt', () => {
    const actions: RunAction[] = [{ type: 'start', deck: 'hello-world' }]
    const dealt = { death: DEATH, rival: { card: RIVAL, by: 'someone' } }
    const once = replayRun(5, actions, dealt)
    assert.ok(once.ok && once.state.death?.card === DEATH && once.state.rival?.by === 'someone')
    assert.deepEqual(replayRun(5, actions, dealt), once)
    const without = replayRun(5, actions)
    assert.ok(without.ok && without.state.death === null && without.state.rival === null)
  })

  it('ignores a malformed death card', () => {
    assert.equal(createRun({ seed: 5, death: 'death:nonsense' }).death, null)
  })
})

describe('a death card in battle', () => {
  it('pays its own cost when sacrificed, and a fresh copy, as Hot Reload makes, has its own stats', () => {
    const reloads = deathCardId({ name: 'Undying', cost: 2, attack: 3, health: 1, art: 'Bug', sigils: ['hot_reload'] })
    const copy = makeUnit(createGame({ seed: 1 }), reloads)
    assert.deepEqual([copy.attack, copy.health, copy.sigils], [3, 1, ['hot_reload']])
    assert.equal(worthOf(copy), 2)
  })
})

describe('a boss bringing a death card', () => {
  const STRONG = deathCardId({ name: 'Too Big', cost: 2, attack: 15, health: 17, art: 'Mainframe', sigils: ['retry'] })

  /** The boss's game, moved into its last phase with its queue cleared, as a phase change leaves it. */
  function lastPhase(id: string, haunt: { card: string; by: string | null }) {
    const game = createGame({ seed: 2, encounter: id, haunt })
    game.opponent.back.fill(null)
    game.opponent.front.fill(null)
    game.opponent.phase = encounter(id).phases.length - 1
    game.opponent.step = 0
    const events: GameEvent[] = []
    queuePlan(game, new Rng(1), events)
    return { game, events }
  }

  it('brings it into the last phase on top of the plan, once', () => {
    const plan = encounter('production-boss').phases[1]?.[0] ?? []
    const { game, events } = lastPhase('production-boss', { card: DEATH, by: null })
    const queued = events.flatMap((event) => (event.type === 'queued' ? [event] : []))
    assert.equal(queued.length, plan.length + 1)
    const haunt = queued.find((event) => event.unit.card === DEATH)
    assert.deepEqual(haunt?.haunt, { by: null })
    // Nothing from the plan is left out to make room.
    for (const planned of plan) assert.ok(queued.some((event) => 'card' in planned && event.unit.card === planned.card))
    const again: GameEvent[] = []
    queuePlan(game, new Rng(2), again)
    assert.ok(!again.some((event) => event.type === 'queued' && event.unit.card === DEATH))
  })

  it("gives a stranger's card the place the plan offers it, rather than adding it", () => {
    const plan = encounter('staging-boss').phases[1]?.[0] ?? []
    const { events } = lastPhase('staging-boss', { card: RIVAL, by: 'someone' })
    const queued = events.flatMap((event) => (event.type === 'queued' ? [event] : []))
    assert.equal(queued.length, plan.length)
    assert.deepEqual(queued.find((event) => event.unit.card === RIVAL)?.haunt, { by: 'someone' })
    assert.ok(!queued.some((event) => event.unit.card === 'Firewall'))
  })

  it('holds it back in the first phase', () => {
    const game = createGame({ seed: 2, encounter: 'production-boss', haunt: { card: DEATH, by: null } })
    assert.ok(![...game.opponent.back, ...game.opponent.front].some((unit) => unit?.card === DEATH))
  })

  it("is the Staging boss with a stranger's card, and the last boss with your own, left out or not", () => {
    const run = createRun({ seed: 4, death: STRONG, rival: { card: RIVAL, by: 'someone' } })
    const boss = (state: RunState, stage: number) => {
      const node = state.map.rows[0]?.[0]
      assert.ok(node)
      node.kind = 'boss'
      node.encounter = ['localhost-boss', 'staging-boss', 'production-boss'][stage] as string
      const entered = step({ ...state, stage, visit: null }, { type: 'go', node: node.id })
      assert.ok(entered.visit?.kind === 'battle')
      return entered.visit.game.opponent.haunt ?? null
    }
    const started = step(run, { type: 'start', deck: 'hello-world', skipDeath: true })
    assert.equal(boss(started, 0), null)
    assert.deepEqual(boss(started, 1), { card: RIVAL, by: 'someone', played: false })
    assert.deepEqual(boss(started, 2), { card: STRONG, by: null, played: false })
  })

  it("never deals a stranger's card over the cap", () => {
    assert.ok(rivalAllowed(RIVAL))
    assert.ok(!rivalAllowed(STRONG))
    assert.equal(createRun({ seed: 4, rival: { card: STRONG, by: 'someone' } }).rival, null)
  })
})
