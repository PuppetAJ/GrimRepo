import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import {
  apply,
  cardsPlayed,
  createGame,
  playOut,
  replay,
  scoreBattle,
  summary,
  type Action,
  type GameState,
} from 'shared'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { insertOldGame, resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

async function signedIn(prefix?: string) {
  const player = newPlayer(prefix)
  const reply = await app.call('POST', '/api/auth/sign-up/email', { body: player })
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  return { ...player, cookie: reply.cookie }
}

const step = (state: GameState, action: Action) => {
  const result = apply(state, action)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

/** Split into the per-bell saves the client makes. */
function botGame(seed: number) {
  const { state, actions } = playOut(createGame({ seed }), step)
  const turns: Action[][] = []
  let current: Action[] = []
  for (const action of actions) {
    current.push(action)
    if (action.type === 'ringBell') {
      turns.push(current)
      current = []
    }
  }
  if (current.length) turns.push(current)
  return { state, actions, turns }
}

async function start(cookie: string) {
  const reply = await app.call('POST', '/api/games', { cookie })
  return reply.body as { id: number; seed: number; actions: Action[]; resumed: boolean }
}

async function submit(cookie: string, id: number, turns: Action[][]) {
  let from = 0
  let last
  for (const actions of turns) {
    last = await app.call('POST', `/api/games/${id}/moves`, { cookie, body: { from, actions } })
    assert.equal(last.status, 200, JSON.stringify(last.body))
    from += actions.length
  }
  return last
}

describe('a game', () => {
  it('cannot be started by someone who is not signed in', async () => {
    assert.equal((await app.call('POST', '/api/games')).status, 401)
  })

  it('starts with a seed the server chose and nothing played', async () => {
    const player = await signedIn()
    const reply = await app.call('POST', '/api/games', { cookie: player.cookie })
    assert.equal(reply.status, 201)
    assert.ok(Number.isInteger(reply.body.seed) && reply.body.seed >= 0 && reply.body.seed < 2 ** 32)
    assert.deepEqual(reply.body.actions, [])
  })

  it('resumes rather than dealing again, so a bad hand cannot be thrown back', async () => {
    const player = await signedIn()
    const first = await start(player.cookie)
    const again = await app.call('POST', '/api/games', { cookie: player.cookie })
    assert.equal(again.status, 200)
    assert.equal(again.body.id, first.id)
    assert.equal(again.body.seed, first.seed)
    assert.equal(again.body.resumed, true)
  })

  it('keeps the moves already played for a resumed game', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const { turns } = botGame(game.seed)
    // One turn, since a game can't be won or lost in one; with stronger cards some end in two.
    await submit(player.cookie, game.id, turns.slice(0, 1))
    const resumed = await start(player.cookie)
    assert.deepEqual(resumed.actions, turns.slice(0, 1).flat())
  })

  it('is scored by the server once its moves replay to a finished game', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const { state, turns } = botGame(game.seed)
    const last = await submit(player.cookie, game.id, turns)
    const expected = summary(state)
    assert.ok(expected)
    assert.equal(last?.body.status, 'finished')
    assert.equal(last?.body.outcome, expected.outcome)
    assert.equal(last?.body.turns, expected.turns)
    assert.equal(last?.body.score, scoreBattle(expected.outcome, expected.turns))

    const { rows } = await pool.query<{ cards: Record<string, number> }>('SELECT cards FROM games WHERE id = $1', [
      game.id,
    ])
    const replayed = replay(game.seed, turns.flat())
    assert.ok(replayed.ok)
    assert.deepEqual(rows[0]?.cards, cardsPlayed(replayed.events), 'the cards played are counted as it finishes')
    const more = await app.call('POST', `/api/games/${game.id}/moves`, {
      cookie: player.cookie,
      body: { from: 0, actions: [] },
    })
    assert.equal(more.status, 404, 'a finished game takes no more moves')
  })

  it('refuses an illegal move and saves nothing from that request', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const reply = await app.call('POST', `/api/games/${game.id}/moves`, {
      cookie: player.cookie,
      body: { from: 0, actions: [{ type: 'ringBell' }] },
    })
    assert.equal(reply.status, 400)
    assert.equal(reply.body.error, 'Illegal move')
    assert.deepEqual((await start(player.cookie)).actions, [])
  })

  it('refuses moves that do not follow on from what was saved', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const { turns } = botGame(game.seed)
    await submit(player.cookie, game.id, turns.slice(0, 1))
    const replayed = await app.call('POST', `/api/games/${game.id}/moves`, {
      cookie: player.cookie,
      body: { from: 0, actions: turns[0] },
    })
    assert.equal(replayed.status, 409)
    assert.equal(replayed.body.expected, turns[0]?.length)
  })

  it('refuses a request carrying a score, or anything the engine does not know', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    for (const body of [
      { from: 0, actions: [], score: 1_000_000 },
      { from: 0, actions: [{ type: 'draw', from: 'deck', score: 5 }] },
      { from: 0, actions: [{ type: 'win' }] },
      { from: -1, actions: [] },
      { outcome: 'win', turns: 3 },
    ]) {
      const reply = await app.call('POST', `/api/games/${game.id}/moves`, { cookie: player.cookie, body })
      assert.equal(reply.status, 400, JSON.stringify(body))
    }
  })

  it('belongs to its player alone', async () => {
    const owner = await signedIn()
    const game = await start(owner.cookie)
    const other = await signedIn()
    const reply = await app.call('POST', `/api/games/${game.id}/moves`, {
      cookie: other.cookie,
      body: { from: 0, actions: [{ type: 'draw', from: 'deck' }] },
    })
    assert.equal(reply.status, 404)
    assert.equal((await app.call('POST', `/api/games/${game.id}/forfeit`, { cookie: other.cookie })).status, 404)
  })

  it('calls a game a new best only when it beats an earlier score', async () => {
    // Plays a bot game to its end, after an earlier finished game scored `offset` from it.
    const finishAfter = async (offset: number | null) => {
      const player = await signedIn()
      const game = await start(player.cookie)
      const { state, turns } = botGame(game.seed)
      const result = summary(state)
      assert.ok(result)
      if (offset !== null)
        await pool.query(
          `INSERT INTO games (user_id, outcome, turns, score, status)
           SELECT id, 'loss', 1, $2, 'finished' FROM users WHERE username = lower($1)`,
          [player.username, scoreBattle(result.outcome, result.turns) + offset],
        )
      return (await submit(player.cookie, game.id, turns))?.body
    }
    const first = await finishAfter(null)
    assert.deepEqual([first.first, first.isBest], [true, false], 'a first game has nothing to beat')
    const beaten = await finishAfter(-1)
    assert.deepEqual([beaten.first, beaten.isBest], [false, true])
    const tied = await finishAfter(0)
    assert.deepEqual([tied.first, tied.isBest], [false, false], 'equalling a best is not a new one')
  })

  it('can be forfeited, which is a loss on the turn it reached, and frees a new deal', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const { turns } = botGame(game.seed)
    // Never the game's last turn: now and then the bot wins on its second.
    const played = Math.min(2, turns.length - 1)
    await submit(player.cookie, game.id, turns.slice(0, played))

    const forfeited = await app.call('POST', `/api/games/${game.id}/forfeit`, { cookie: player.cookie })
    assert.equal(forfeited.status, 200)
    assert.equal(forfeited.body.outcome, 'loss')
    assert.equal(forfeited.body.turns, played + 1)

    const { rows } = await pool.query('SELECT outcome, forfeited FROM games WHERE id = $1', [game.id])
    assert.deepEqual(rows[0], { outcome: 'loss', forfeited: true })
    const fresh = await start(player.cookie)
    assert.notEqual(fresh.id, game.id)
  })

  it('is dropped and dealt again when it began under older rules, never scored', async () => {
    const player = await signedIn()
    const old = await insertOldGame(player.username, 1)
    const reply = await app.call('POST', '/api/games', { cookie: player.cookie })
    assert.equal(reply.status, 201)
    assert.notEqual(reply.body.id, old)
    assert.equal(reply.body.rulesChanged, true)
    assert.deepEqual(reply.body.actions, [])
    const { rows } = await pool.query('SELECT 1 FROM games WHERE id = $1', [old])
    assert.equal(rows.length, 0, 'the old record is gone, not scored')
  })

  it('refuses moves for a game from older rules, so the page can pick up the new deal', async () => {
    const player = await signedIn()
    const old = await insertOldGame(player.username, 1)
    const reply = await app.call('POST', `/api/games/${old}/moves`, {
      cookie: player.cookie,
      body: { from: 1, actions: [] },
    })
    assert.equal(reply.status, 409)
    assert.equal(reply.body.rulesChanged, true)
  })

  it('stays off the leaderboard and the profile, which count runs only', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    await submit(player.cookie, game.id, botGame(game.seed).turns)
    assert.deepEqual((await app.call('GET', '/api/leaderboard')).body.players, [])
    assert.equal((await app.call('GET', `/api/players/${player.username}/stats`)).body.runs, 0)
  })

  it('answers malformed JSON with a 400, not a stack trace', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const reply = await app.call('POST', `/api/games/${game.id}/moves`, { cookie: player.cookie, raw: '{"from": 0,' })
    assert.equal(reply.status, 400)
    assert.equal(reply.body.error, 'Malformed JSON')
  })

  it('refuses a body far larger than any turn', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const reply = await app.call('POST', `/api/games/${game.id}/moves`, {
      cookie: player.cookie,
      raw: JSON.stringify({ pad: 'x'.repeat(40_000) }),
    })
    assert.equal(reply.status, 413)
  })
})
