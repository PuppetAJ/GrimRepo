import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card, deathCardId, parseDeathCard } from '../cards.ts'
import { createGame } from '../engine/game.ts'
import { makeUnit, worthOf } from '../engine/units.ts'
import { scoreRun } from '../scoring.ts'
import { buildDeathCard, deathCost, deathParts } from './death.ts'
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
  ]

  it('takes the cost from one card, the stats from another and one sigil from a third', () => {
    const built = buildDeathCard(deck, {
      cost: 4,
      stats: 3,
      sigil: { card: 1, sigil: 'broadcast' },
      name: 'Grim  Ping ',
    })
    assert.ok(built.ok)
    const def = card(built.id)
    assert.deepEqual(
      [def.name, def.cost, def.attack, def.health, def.sigils, def.art],
      ['Grim Ping', 1, 4, 2, ['broadcast'], 'NullPointer'],
    )
  })

  it('keeps the buffs the stats card gained in the run', () => {
    const built = buildDeathCard(deck, { cost: 2, stats: 2, sigil: null, name: 'Big Iron' })
    assert.ok(built.ok)
    assert.equal(card(built.id).attack, 15)
  })

  it('costs at most one less than the stats card, and something if that card did', () => {
    // A free card's cost can't put a 3-cost card's stats into play for nothing.
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'Mainframe')), 2)
    assert.equal(deathCost(entry(0, 'Mainframe'), entry(0, 'HelloWorld')), 3)
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'CronJob')), 0)
    // Free cards with 1-cost stats doubled the bot's score, so a card that cost something stays at 1 or more.
    assert.equal(deathCost(entry(0, 'HelloWorld'), entry(0, 'Firewall')), 1)
  })

  it('never uses a death card as a part, so costs cannot be shaved run after run', () => {
    const withDeath = [...deck, entry(9, DEATH)]
    assert.ok(!deathParts(withDeath).some((part) => part.id === 9))
    for (const choice of [
      { cost: 9, stats: 3, sigil: null },
      { cost: 1, stats: 9, sigil: null },
      { cost: 1, stats: 3, sigil: { card: 9, sigil: 'retry' as const } },
    ])
      assert.ok(!buildDeathCard(withDeath, { ...choice, name: 'Again' }).ok)
  })

  it('refuses a sigil the card lacks, a card not in the deck, and a bad name', () => {
    assert.ok(!buildDeathCard(deck, { cost: 1, stats: 3, sigil: { card: 4, sigil: 'retry' }, name: 'Nope' }).ok)
    assert.ok(!buildDeathCard(deck, { cost: 1, stats: 99, sigil: null, name: 'Nope' }).ok)
    for (const name of ['', '   ', 'Seventeen chars!!', '<b>', ' -lead'])
      assert.ok(!buildDeathCard(deck, { cost: 1, stats: 3, sigil: null, name }).ok, name)
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

  it('replays the same with the same death card', () => {
    const actions: RunAction[] = [{ type: 'start', deck: 'hello-world' }]
    const once = replayRun(5, actions, DEATH)
    assert.ok(once.ok && once.state.death?.card === DEATH)
    assert.deepEqual(replayRun(5, actions, DEATH), once)
    const without = replayRun(5, actions)
    assert.ok(without.ok && without.state.death === null)
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

describe('the score without a death card', () => {
  it('is worth a quarter more', () => {
    const record = { battles: 4, bosses: 1, overkill: 5 }
    assert.equal(scoreRun(record, false, true), Math.round(scoreRun(record, false) * 1.25))
  })
})
