import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { applyRun, createRun, playRun, RUN_SAVE_LIMIT, scoreRun, type RunAction, type RunState } from 'shared'
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
    ...(reply.body as { id: number; seed: number; actions: RunAction[]; resumed: boolean }),
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
