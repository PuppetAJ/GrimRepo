import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import {
  applyRun,
  card,
  createRun,
  deathCardId,
  deathHands,
  deathSkipBonus,
  playRun,
  replayRun,
  rivalAllowed,
  RUN_SAVE_LIMIT,
  scoreRun,
  type RunAction,
  type RunState,
} from 'shared'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

async function signedIn() {
  const player = newPlayer('runner')
  const reply = await app.call('POST', '/api/auth/sign-up/email', { body: player })
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  return { ...player, cookie: reply.cookie }
}

const step = (state: RunState, action: RunAction) => {
  const result = applyRun(state, action)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

async function start(cookie: string) {
  const reply = await app.call('POST', '/api/runs', { cookie })
  return {
    status: reply.status,
    ...(reply.body as {
      id: number
      seed: number
      actions: RunAction[]
      resumed: boolean
      death: string | null
      rival: { card: string; by: string } | null
    }),
  }
}

/** Sends a bot's whole run in saves as large as the server takes. */
async function submit(cookie: string, id: number, actions: RunAction[]) {
  let last
  for (let from = 0; from < actions.length; from += RUN_SAVE_LIMIT) {
    last = await app.call('POST', `/api/runs/${id}/moves`, {
      cookie,
      body: { from, actions: actions.slice(from, from + RUN_SAVE_LIMIT) },
    })
    assert.equal(last.status, 200, JSON.stringify(last.body))
  }
  return last
}

describe('a run', () => {
  it('cannot be started by someone who is not signed in', async () => {
    assert.equal((await app.call('POST', '/api/runs')).status, 401)
  })

  it('starts on a seed the server chose, and resumes rather than starting again', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    assert.equal(run.status, 201)
    assert.deepEqual(run.actions, [])
    const moves = playRun(createRun({ seed: run.seed }), step).actions.slice(0, 5)
    await submit(player.cookie, run.id, moves)
    const again = await start(player.cookie)
    assert.equal(again.status, 200)
    assert.equal(again.id, run.id)
    assert.deepEqual(again.actions, moves, 'another device picks up the same run')
  })

  it('is scored by the server once its actions replay to the end', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    const { state, actions } = playRun(createRun({ seed: run.seed }), step)
    const last = await submit(player.cookie, run.id, actions)
    assert.equal(last?.body.status, state.status)
    assert.equal(last?.body.score, scoreRun(state.record, state.status === 'won'))
    const { rows } = await pool.query('SELECT status, score, bosses FROM runs WHERE id = $1', [run.id])
    assert.deepEqual(rows[0], { status: state.status, score: last?.body.score, bosses: state.record.bosses })
  })

  it('refuses an illegal action and saves nothing from that request', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    const reply = await app.call('POST', `/api/runs/${run.id}/moves`, {
      cookie: player.cookie,
      body: { from: 0, actions: [{ type: 'take', index: 0 }] },
    })
    assert.equal(reply.status, 400)
    assert.equal(reply.body.error, 'Illegal move')
    assert.deepEqual((await start(player.cookie)).actions, [])
  })

  it('refuses anything the engine does not know, a score included', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    for (const actions of [[{ type: 'win' }], [{ type: 'leave', score: 99_999 }], [{ type: 'go', node: '../1' }]]) {
      const reply = await app.call('POST', `/api/runs/${run.id}/moves`, {
        cookie: player.cookie,
        body: { from: 0, actions },
      })
      assert.equal(reply.status, 400, JSON.stringify(actions))
    }
  })

  it('takes a full save of the largest actions within the body limit, and no more', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    const largest = { type: 'transfer', from: 999_999, to: 999_999, sigil: 'technical_debt' }
    const save = (count: number) =>
      app.call('POST', `/api/runs/${run.id}/moves`, {
        cookie: player.cookie,
        body: { from: 0, actions: Array(count).fill(largest) },
      })
    // Reaching the replay, which refuses them, shows the body was read.
    assert.equal((await save(RUN_SAVE_LIMIT)).body.error, 'Illegal move')
    assert.equal((await save(RUN_SAVE_LIMIT + 1)).body.error, 'Invalid moves')
  })

  it('refuses actions that do not follow on from what was saved', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    const moves = playRun(createRun({ seed: run.seed }), step).actions.slice(0, 4)
    await submit(player.cookie, run.id, moves.slice(0, 2))
    const reply = await app.call('POST', `/api/runs/${run.id}/moves`, {
      cookie: player.cookie,
      body: { from: 0, actions: moves },
    })
    assert.equal(reply.status, 409)
    assert.equal(reply.body.expected, 2)
  })

  it('belongs to its player alone', async () => {
    const owner = await signedIn()
    const other = await signedIn()
    const run = await start(owner.cookie)
    const reply = await app.call('POST', `/api/runs/${run.id}/moves`, {
      cookie: other.cookie,
      body: { from: 0, actions: [] },
    })
    assert.equal(reply.status, 404)
  })

  it('can be forfeited as a loss scored on how far it got, which frees a new run', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    const moves = playRun(createRun({ seed: run.seed }), step).actions.slice(0, 20)
    await submit(player.cookie, run.id, moves)
    const reply = await app.call('POST', `/api/runs/${run.id}/forfeit`, { cookie: player.cookie })
    assert.equal(reply.status, 200)
    assert.equal(reply.body.status, 'lost')
    assert.equal(reply.body.forfeited, true)
    const next = await start(player.cookie)
    assert.notEqual(next.id, run.id)
  })

  it('is dropped and started again when it began under older rules', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    await pool.query('UPDATE runs SET run_version = 0 WHERE id = $1', [run.id])
    const again = await app.call('POST', '/api/runs', { cookie: player.cookie })
    assert.equal(again.status, 201)
    assert.equal(again.body.rulesChanged, true)
    assert.notEqual(again.body.id, run.id)
    assert.equal((await pool.query('SELECT 1 FROM runs WHERE id = $1', [run.id])).rowCount, 0)
  })
})

describe('the run actions the server takes', () => {
  it('include every kind the engine has, so a legal move is never refused as unknown', async () => {
    const player = await signedIn()
    const run = await start(player.cookie)
    // One of each; most are illegal here, which the replay says, but none may be refused before it.
    const kinds: RunAction[] = [
      { type: 'start', deck: 'hello-world' },
      { type: 'start', deck: 'hello-world', skipDeath: true },
      { type: 'go', node: '0-0' },
      { type: 'play', action: { type: 'ringBell' } },
      { type: 'take', index: 0 },
      { type: 'buff', card: 1 },
      { type: 'transfer', from: 1, to: 2, sigil: 'bypass' },
      { type: 'choose', option: 0 },
      { type: 'strip', card: 1, sigil: 'bypass' },
      { type: 'buy', index: 0 },
      { type: 'uninstall', card: 1 },
      { type: 'buyItem' },
      { type: 'pickItem', index: 0, drop: 1 },
      { type: 'play', action: { type: 'use', slot: 0, row: 'front', lane: 1 } },
      { type: 'fuse', card: 1 },
      { type: 'fuse', card: 1, with: 2 },
      { type: 'leave' },
    ]
    for (const action of kinds) {
      const reply = await app.call('POST', `/api/runs/${run.id}/moves`, {
        cookie: player.cookie,
        body: { from: 0, actions: [action] },
      })
      assert.notEqual(reply.body.error, 'Invalid moves', JSON.stringify(action))
    }
  })
})

/** Plays a few moves of a new run and forfeits it, returning the run and the state it ended in. */
async function lose(cookie: string, opening: RunAction = { type: 'start', deck: 'hello-world' }) {
  const run = await start(cookie)
  const dealt = { death: run.death, rival: run.rival }
  const begun = step(createRun({ seed: run.seed, ...dealt }), opening)
  const moves = [opening, ...playRun(begun, step).actions.slice(0, 15)]
  await submit(cookie, run.id, moves)
  const forfeit = await app.call('POST', `/api/runs/${run.id}/forfeit`, { cookie })
  assert.equal(forfeit.status, 200)
  const replayed = replayRun(run.seed, moves, dealt)
  assert.ok(replayed.ok)
  return { run, score: forfeit.body.score as number, state: replayed.state }
}

/** The first card of each hand the lost run deals. */
function firstOfEach(state: RunState, name: string) {
  const [costs, stats, sigils] = deathHands(state)
  return { cost: costs[0]?.id ?? -1, stats: stats[0]?.id ?? -1, sigils: sigils[0]?.id ?? -1, name }
}

const build = (cookie: string, id: number, body: object) =>
  app.call('POST', `/api/runs/${id}/death-card`, { cookie, body })

describe('a death card', () => {
  it('is built from the hands a lost run deals, kept, shown on the profile and dealt into the next run', async () => {
    const player = await signedIn()
    const { run, state } = await lose(player.cookie)
    const reply = await build(player.cookie, run.id, firstOfEach(state, 'Ghost'))
    assert.equal(reply.status, 200, JSON.stringify(reply.body))
    assert.equal(reply.body.saved, true)
    assert.equal(card(reply.body.card).name, 'Ghost')
    const profile = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(profile.body.deathCard, reply.body.card)
    const next = await start(player.cookie)
    assert.equal(next.death, reply.body.card)
  })

  it('is built once, from the latest run only, and only once that run is lost', async () => {
    const player = await signedIn()
    const { run, state } = await lose(player.cookie)
    const choice = firstOfEach(state, 'Once')
    assert.equal((await build(player.cookie, run.id, choice)).status, 200)
    assert.equal((await build(player.cookie, run.id, choice)).status, 409)
    const open = await start(player.cookie)
    assert.equal((await build(player.cookie, open.id, choice)).status, 404)
    const stranger = await signedIn()
    assert.equal((await build(stranger.cookie, run.id, choice)).status, 404)
  })

  it('refuses an offensive name and a card from outside its hand', async () => {
    const player = await signedIn()
    const { run, state } = await lose(player.cookie)
    const choice = firstOfEach(state, 'Ok')
    assert.equal((await build(player.cookie, run.id, { ...choice, name: 'fuck' })).status, 400)
    assert.equal((await build(player.cookie, run.id, { ...choice, cost: 999 })).status, 400)
    assert.equal((await build(player.cookie, run.id, choice)).status, 200)
  })

  it('left out of a run, multiplies its score by a bonus that grows with the card', async () => {
    const player = await signedIn()
    const first = await lose(player.cookie)
    await build(player.cookie, first.run.id, firstOfEach(first.state, 'Skipped'))
    const { score, state } = await lose(player.cookie, { type: 'start', deck: 'hello-world', skipDeath: true })
    assert.ok(state.death?.skipped)
    assert.equal(score, scoreRun(state.record, false, deathSkipBonus(state.death.card)))
  })

  it('is shown to a guest but not kept', async () => {
    const visitor = await app.call('POST', '/api/auth/sign-in/anonymous')
    const { run, state } = await lose(visitor.cookie)
    const reply = await build(visitor.cookie, run.id, firstOfEach(state, 'Guest'))
    assert.equal(reply.status, 200)
    assert.equal(reply.body.saved, false)
    assert.equal((await start(visitor.cookie)).death, null)
  })
})

describe("another player's death card", () => {
  it("is dealt into someone else's run with its maker's name, never into the maker's own", async () => {
    const maker = await signedIn()
    const small = deathCardId({ name: 'Haunt', cost: 1, attack: 3, health: 3, art: 'Watchdog', sigils: [] })
    assert.ok(rivalAllowed(small))
    await pool.query('UPDATE users SET death_card = $1 WHERE username = LOWER($2)', [small, maker.username])
    const other = await signedIn()
    assert.deepEqual((await start(other.cookie)).rival, { card: small, by: maker.username })
    assert.equal((await start(maker.cookie)).rival, null)
  })

  it('is never one over the cap', async () => {
    const maker = await signedIn()
    const strong = deathCardId({ name: 'Too Big', cost: 2, attack: 15, health: 17, art: 'Mainframe', sigils: [] })
    await pool.query('UPDATE users SET death_card = $1 WHERE username = LOWER($2)', [strong, maker.username])
    const other = await signedIn()
    assert.equal((await start(other.cookie)).rival, null)
  })
})

describe('the runs leaderboard', () => {
  it('ranks players by their best finished run, counting the runs they cleared', async () => {
    const player = await signedIn()
    assert.deepEqual((await app.call('GET', '/api/leaderboard/runs')).body.players, [])
    const run = await start(player.cookie)
    const { state, actions } = playRun(createRun({ seed: run.seed }), step)
    assert.deepEqual((await app.call('GET', '/api/leaderboard/runs')).body.players, [], 'an open run is not ranked')
    await submit(player.cookie, run.id, actions)
    const { body } = await app.call('GET', '/api/leaderboard/runs')
    assert.equal(body.players.length, 1)
    assert.equal(body.players[0].bestScore, scoreRun(state.record, state.status === 'won'))
    assert.equal(body.players[0].games, 1)
    assert.equal(body.players[0].wins, state.status === 'won' ? 1 : 0)
    assert.equal(body.top, body.players[0].bestScore)
  })
})
