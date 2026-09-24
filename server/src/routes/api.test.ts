import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { apply, createGame, playOut, scoreBattle, summary, type Action, type GameState } from 'shared'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { insertGame, resetDatabase } from '../test/support.ts'

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

/** The bot's whole game for a seed, cut into the per-bell saves the client makes. */
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
    await submit(player.cookie, game.id, turns.slice(0, 2))
    const resumed = await start(player.cookie)
    assert.deepEqual(resumed.actions, turns.slice(0, 2).flat())
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

    const stats = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(stats.body.games, 1)
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

  it('can be forfeited, which is a loss on the turn it reached, and frees a new deal', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    const { turns } = botGame(game.seed)
    await submit(player.cookie, game.id, turns.slice(0, 2))

    const forfeited = await app.call('POST', `/api/games/${game.id}/forfeit`, { cookie: player.cookie })
    assert.equal(forfeited.status, 200)
    assert.equal(forfeited.body.outcome, 'loss')
    assert.equal(forfeited.body.turns, 3)

    const stats = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(stats.body.recent[0].forfeited, true)
    const fresh = await start(player.cookie)
    assert.notEqual(fresh.id, game.id)
  })

  it('stays off the leaderboard until it is finished', async () => {
    const player = await signedIn()
    const game = await start(player.cookie)
    await submit(player.cookie, game.id, botGame(game.seed).turns.slice(0, 1))
    assert.deepEqual((await app.call('GET', '/api/leaderboard')).body.players, [])
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

describe('the leaderboard', () => {
  it('ranks players by their best game', async () => {
    const slow = await signedIn('slow')
    const fast = await signedIn('fast')
    await insertGame(slow.username, 'win', 25)
    await insertGame(fast.username, 'win', 6)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { username: string }) => row.username),
      [fast.username, slow.username],
    )
    assert.equal(body.players[0].rank, 1)
  })

  it('keeps a best score when a worse game follows it', async () => {
    const player = await signedIn()
    await insertGame(player.username, 'win', 6)
    await insertGame(player.username, 'loss', 3)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.equal(body.players[0].bestScore, scoreBattle('win', 6))
    assert.equal(body.players[0].games, 2)
  })

  it('gives tied players the same rank', async () => {
    const one = await signedIn('tied')
    const two = await signedIn('tied')
    await insertGame(one.username, 'win', 10)
    await insertGame(two.username, 'win', 10)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { rank: number }) => row.rank),
      [1, 1],
    )
  })

  it('leaves out players who have never finished a game', async () => {
    await signedIn()
    assert.deepEqual((await app.call('GET', '/api/leaderboard')).body.players, [])
  })

  it('never shows an email address', async () => {
    const player = await signedIn()
    await insertGame(player.username, 'win', 10)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.ok(!JSON.stringify(body).includes('@'), JSON.stringify(body))
  })
})

describe('a player’s stats', () => {
  it('add up after a mix of wins and losses', async () => {
    const player = await signedIn('Mixed')
    const games = [
      ['win', 12, 4],
      ['loss', 4, 3],
      ['win', 9, 2],
      ['loss', 20, 1],
    ] as const
    for (const [outcome, turns, daysAgo] of games) await insertGame(player.username, outcome, turns, daysAgo)

    const { status, body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(status, 200)
    assert.equal(body.username, player.username)
    assert.deepEqual([body.games, body.wins, body.losses, body.winRate], [4, 2, 2, 0.5])
    assert.equal(body.bestScore, scoreBattle('win', 9))
    assert.equal(body.bestWinTurns, 9)
    assert.equal(body.averageTurns, 11.3)
    assert.deepEqual(
      body.recent.map((game: { turns: number }) => game.turns),
      [20, 9, 4, 12],
      'newest first',
    )
  })

  it('count games per day for the activity grid', async () => {
    const player = await signedIn()
    await insertGame(player.username, 'win', 10, 3)
    await insertGame(player.username, 'loss', 5, 3)
    await insertGame(player.username, 'loss', 5, 1)
    await insertGame(player.username, 'win', 10, 400)
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.deepEqual(
      body.days.map((day: { games: number; losses: number }) => [day.games, day.losses]),
      [
        [2, 1],
        [1, 1],
      ],
      'a game from more than half a year ago is not in the grid',
    )
  })

  it('are public and found whatever the case of the name', async () => {
    const player = await signedIn('CaseSensitive')
    await insertGame(player.username, 'win', 10)
    const reply = await app.call('GET', `/api/players/${player.username.toLowerCase()}/stats`)
    assert.equal(reply.status, 200)
    assert.equal(reply.body.username, player.username)
  })

  it('exist, empty, for a player who has not played', async () => {
    const player = await signedIn()
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.games, 0)
    assert.equal(body.winRate, null)
    assert.deepEqual(body.recent, [])
  })

  it('are a 404 for nobody, or for a name that could not exist', async () => {
    assert.equal((await app.call('GET', '/api/players/nobody_here/stats')).status, 404)
    assert.equal((await app.call('GET', '/api/players/no%20spaces/stats')).status, 404)
  })

  it('never include an email address', async () => {
    const player = await signedIn()
    await insertGame(player.username, 'win', 10)
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.ok(!JSON.stringify(body).includes('@'))
  })
})
